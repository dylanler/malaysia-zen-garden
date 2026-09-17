import * as THREE from 'three';
import { Save } from './Save';
import { Input } from './Input';
import { Interaction } from './Interaction';
import { Locomotion } from './Locomotion';
import { TimeOfDay } from './TimeOfDay';
import { Weather } from './Weather';
import { isMobileUA, isTouchDevice, clamp } from './util';
import { Terrain, WATER_Y } from '../world/Terrain';
import { Path } from '../world/Path';
import { Water } from '../world/Water';
import { Sky } from '../world/Sky';
import { Vegetation } from '../world/Vegetation';
import { Rain, Ripples, Fireflies } from '../world/Particles';
import { AudioEngine } from '../audio/AudioEngine';
import { Synth } from '../audio/Synth';
import { Music, type InstrumentName } from '../audio/Music';
import { Ambience } from '../audio/Ambience';
import { UI } from '../ui/UI';
import { HandsView } from '../systems/HandsView';
import type { Station, StationContext, Quality } from '../stations/Station';
import { createStations } from '../stations';
import { STATIONS, STATION_BY_ID, type StationId } from '../content/stations';

const INSTRUMENTS: Partial<Record<StationId, InstrumentName>> = {
  rumah: 'gamelan',
  airterjun: 'plink',
  sawah: 'gongs',
  panjai: 'engkerumong',
  jalan: 'zither',
};

export class App {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  save = new Save();
  ui: UI;
  input: Input;
  interaction: Interaction;
  locomotion: Locomotion;
  time: TimeOfDay;
  weather = new Weather();
  terrain: Terrain;
  path: Path;
  water: Water;
  sky: Sky;
  vegetation: Vegetation;
  rain: Rain;
  ripples: Ripples;
  fireflies: Fireflies;
  effects = new THREE.Group();
  audio = new AudioEngine();
  synth: Synth;
  music: Music;
  ambience: Ambience;
  hands: HandsView;
  stations: Station[] = [];
  current: Station | null = null;
  quality: Quality;
  private clock = new THREE.Clock();
  private elapsed = 0;
  private started = false;
  private frameTimes: number[] = [];
  private dprCap: number;
  private dpr: number;
  private saveTimer = 0;
  private movedOnce = false;
  private startTime = 0;
  private handPos = new THREE.Vector3();
  private stepAlt = false;

  constructor() {
    const s = this.save.settings;
    const mobile = isMobileUA() || (isTouchDevice() && Math.min(window.innerWidth, window.innerHeight) < 900);
    const low = s.quality === 'low' || (s.quality === 'auto' && (mobile || (navigator.hardwareConcurrency ?? 8) <= 4));
    const shadows = s.quality === 'high' ? true : !low;
    this.quality = { shadows, mobile, low };
    this.dprCap = low ? 1.5 : 2;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);

    this.ui = new UI(s);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.ui.canvas,
      antialias: !low,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const portrait = window.innerHeight > window.innerWidth;
    this.camera = new THREE.PerspectiveCamera(mobile ? (portrait ? 74 : 66) : 62, window.innerWidth / window.innerHeight, 0.05, 800);
    this.scene.add(this.camera);

    // world
    this.terrain = new Terrain();
    this.path = new Path(this.terrain);
    this.scene.add(this.terrain.buildMesh(this.path, low ? 110 : 170));
    this.water = new Water();
    this.scene.add(this.water.mesh);
    this.sky = new Sky();
    this.scene.add(this.sky.group);
    this.vegetation = new Vegetation(this.terrain, this.path, {
      trees: low ? 170 : 360,
      palms: low ? 34 : 70,
      grass: low ? 1800 : 4500,
      padi: low ? 2600 : 7000,
      shadows,
    });
    this.scene.add(this.vegetation.group);
    this.scene.add(this.effects);
    this.rain = new Rain(low ? 900 : 2200);
    this.effects.add(this.rain.mesh);
    this.ripples = new Ripples(14);
    this.effects.add(this.ripples.group);
    // a few swarms have drifted out over the water, within reach of the sampan
    const swarms = [...this.vegetation.berembang];
    const [w0, w1] = this.path.waterRange;
    const pt = new THREE.Vector3();
    const tan = new THREE.Vector3();
    for (let i = 0; i < 6; i++) {
      const u = w0 + ((i + 0.5) / 6) * (w1 - w0);
      this.path.getPoint(u, pt);
      this.path.getTangent(u, tan);
      const side = i % 2 === 0 ? 1 : -1;
      pt.x += -tan.z * side * 3.6;
      pt.z += tan.x * side * 3.6;
      pt.y = WATER_Y - 2.6;
      swarms.push(pt.clone());
    }
    this.fireflies = new Fireflies(swarms, low ? 40 : 80);
    this.effects.add(this.fireflies.points);

    this.time = new TimeOfDay(this.scene, this.renderer, this.sky, this.water, shadows);

    // player
    this.input = new Input(this.ui.canvas, this.ui.walkButton, this.ui.joystick);
    this.interaction = new Interaction(this.camera);
    this.input.handler = this.interaction;
    this.scene.add(this.interaction.markers);
    this.locomotion = new Locomotion(this.camera, this.path, this.terrain, this.input);
    this.locomotion.reducedMotion = s.reducedMotion;
    this.locomotion.setMode(s.locomotion);
    this.hands = new HandsView(this.camera, this.interaction, this.locomotion, this.ui);

    // audio
    this.synth = new Synth(this.audio);
    this.music = new Music(this.audio, this.synth);
    this.ambience = new Ambience(this.audio, this.synth, this.music, this.weather);
    this.audio.setVolume(s.volume);

    const ctx: StationContext = {
      scene: this.scene,
      camera: this.camera,
      terrain: this.terrain,
      path: this.path,
      water: this.water,
      vegetation: this.vegetation,
      time: this.time,
      weather: this.weather,
      interaction: this.interaction,
      locomotion: this.locomotion,
      audio: this.audio,
      synth: this.synth,
      music: this.music,
      ambience: this.ambience,
      ui: this.ui,
      save: this.save,
      ripples: this.ripples,
      fireflies: this.fireflies,
      hands: this.hands,
      quality: this.quality,
      effects: this.effects,
      newLoop: () => this.newLoop(),
    };
    this.stations = createStations(ctx);
    for (const st of this.stations) st.build();
    for (const id of this.save.progress.completed) {
      const st = this.stations.find((x) => x.def.id === id);
      if (st) st.completed = true;
    }

    this.locomotion.onStep = (surface) => {
      this.stepAlt = !this.stepAlt;
      if (surface === 'jetty') this.synth.footstep('wood');
      else if (surface === 'land') this.synth.footstep(this.stepAlt ? 'dirt' : 'grass');
    };
    this.locomotion.onArrive = () => this.ui.setWalkAuto(false);
    this.interaction.onEmptyTapCallback = () => {
      if (this.locomotion.seat) this.current?.onEmptyTap?.();
    };

    this.ui.onSettings((st) => this.applySettings(st));
    this.ui.onReset(() => {
      this.save.resetProgress();
      location.reload();
    });
    this.ui.setJoystickVisible(s.locomotion === 'free');
    this.ui.setProgress(this.save.progress.visited, this.save.progress.completed, null);

    window.addEventListener('resize', () => this.onResize());
    this.ui.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.ui.toast('The garden blinked. Reloading.');
      window.setTimeout(() => location.reload(), 800);
    });

    const resume = this.save.hasProgress();
    if (resume) {
      const last = this.save.progress.visited[this.save.progress.visited.length - 1] as StationId | undefined;
      const name = last ? STATION_BY_ID[last]?.names.native : null;
      this.ui.setResumeNote(name ? `You left off near ${name}. The garden kept your place.` : null);
    }

    this.ui.onEnter(() => void this.begin(resume));
  }

  private async begin(resume: boolean) {
    await this.audio.unlock();
    this.ui.hideTitle();
    if (resume) {
      this.locomotion.teleport(this.save.progress.u);
      this.locomotion.faceAlongPath();
      this.time.setHour(this.save.progress.hour);
      if (this.save.progress.lanternLit) this.stations.find((s) => s.def.id === 'jalan')?.restore?.();
    } else {
      this.locomotion.teleport(0);
      this.locomotion.faceAlongPath();
      this.time.setHour(6.75);
    }
    this.started = true;
    this.startTime = performance.now();
    this.clock.start();
    this.loop();
  }

  private applySettings(s: typeof this.save.settings) {
    this.audio.setVolume(s.volume);
    this.locomotion.reducedMotion = s.reducedMotion;
    if (s.locomotion !== this.locomotion.mode) {
      this.locomotion.setMode(s.locomotion);
      this.ui.setJoystickVisible(s.locomotion === 'free');
      this.ui.toast(s.locomotion === 'free' ? 'Free roam: walk with WASD or the joystick.' : 'Stroll: hold the round button or W to follow the path.');
    }
    const wantLow = s.quality === 'low' || (s.quality === 'auto' && this.quality.mobile);
    const wantShadows = s.quality === 'high' ? true : !wantLow;
    if (wantShadows !== this.quality.shadows || wantLow !== this.quality.low) {
      this.save.flush(true);
      this.ui.toast('Changing quality. One moment.');
      window.setTimeout(() => location.reload(), 600);
      return;
    }
    this.save.flush();
  }

  private onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    const portrait = h > w;
    this.camera.fov = this.quality.mobile ? (portrait ? 74 : 66) : 62;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private adaptResolution(dtMs: number) {
    this.frameTimes.push(dtMs);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    let next = this.dpr;
    if (avg > 26) next = Math.max(0.7, this.dpr * 0.85);
    else if (avg < 14 && this.dpr < Math.min(this.dprCap, window.devicePixelRatio || 1)) next = Math.min(this.dprCap, this.dpr * 1.08);
    if (Math.abs(next - this.dpr) > 0.01) {
      this.dpr = next;
      this.renderer.setPixelRatio(this.dpr);
      this.fireflies.uniforms.uPixelRatio.value = this.dpr;
    }
  }

  private loop = () => {
    requestAnimationFrame(this.loop);
    const dtRaw = this.clock.getDelta();
    const dt = clamp(dtRaw, 0, 0.05);
    this.elapsed += dt;
    const t = this.elapsed;
    if (document.hidden) return;

    this.input.poll();
    if (this.input.consumeMenuRequest()) this.ui.toggleMenu();
    if (this.ui.menuOpen) {
      this.input.consumeLook();
    }

    this.locomotion.update(dt);
    this.ui.setWalkAuto(this.locomotion.autoWalk);
    if (!this.movedOnce && (this.locomotion.walking > 0.2 || this.locomotion.u > 0.003)) this.movedOnce = true;

    this.updateStations(dt, t);

    // weather → world
    this.weather.update(dt);
    this.rain.intensity = this.weather.rain;
    this.rain.update(t, this.camera.position);
    this.time.overcast = this.weather.overcast;
    this.time.fogBoost = 1 + this.weather.rain * 0.8;
    this.terrain.setWetness(this.weather.wetness);
    this.time.update(dt, t, this.camera.position);

    const windBase = this.current?.def.id === 'padang' ? 1.0 : this.current?.def.id === 'sawah' ? 0.85 : 0.45;
    this.vegetation.setWind(windBase + this.weather.rain * 0.7);
    this.vegetation.update(dt, t);
    this.ripples.update(dt);
    this.locomotion.handPosition(this.handPos);
    this.fireflies.update(dt, t, this.time.night, this.handPos);
    this.hands.update(dt, t);
    this.interaction.update(dt);

    // audio
    this.ambience.setTime(this.time.hour, this.time.night);
    this.ambience.setListener(this.camera.position);
    this.ambience.update(dt);
    this.music.update(dt);

    // ui
    let hint = this.interaction.hintText();
    if (!hint && !this.movedOnce && performance.now() - this.startTime > 9000 && !this.hands.active) {
      hint = this.input.isTouch ? 'Hold the round button to stroll · drag to look around' : 'Hold W or Space to stroll · drag to look around';
    }
    if (this.locomotion.seat && !hint) hint = 'Tap anywhere to stand up';
    this.ui.setHint(hint);
    this.ui.setIdle(this.input.idleSeconds > 6 && !this.hands.active);

    // persist
    this.saveTimer += dt;
    if (this.saveTimer > 2) {
      this.saveTimer = 0;
      this.save.progress.u = this.locomotion.u;
      this.save.progress.hour = this.time.hour;
      this.save.flush();
    }

    this.renderer.render(this.scene, this.camera);
    this.adaptResolution(dtRaw * 1000);
  };

  private updateStations(dt: number, t: number) {
    let best: Station | null = null;
    let bestScore = Infinity;
    const p = this.camera.position;
    for (const st of this.stations) {
      const score = st.score(p);
      if (score < 1 && score < bestScore) {
        bestScore = score;
        best = st;
      }
    }
    if (best !== this.current) {
      this.current?.exit();
      this.current = best;
      if (best) this.enterStation(best);
      else {
        this.music.instrument = null;
        this.ui.clearAfterword();
      }
    }
    for (const st of this.stations) st.update(dt, t);
  }

  private enterStation(st: Station) {
    const firstThisLoop = !st.visited;
    st.visited = true;
    st.enter();
    this.save.markVisited(st.def.id);
    this.ui.setProgress(this.save.progress.visited, this.save.progress.completed, st.def.id);
    if (firstThisLoop) this.ui.showStationCard(st.def);
    this.ambience.setZone(st.def.id);
    const target = st.targetHour();
    const ahead = (target - this.time.hour + 24) % 24;
    if (ahead > 0.05 && ahead < 12) this.time.tweenTo(target, 22);
    this.music.instrument = INSTRUMENTS[st.def.id] ?? null;
    if (st.completed) window.setTimeout(() => st.active && this.ui.showAfterword(st.def.afterword), 4000);
  }

  /** Start the day again after the pelita are lit: a slow dawn, and every station ready to be found again. */
  newLoop() {
    for (const st of this.stations) {
      st.reset();
      st.visited = false;
    }
    this.save.progress.loops += 1;
    this.save.progress.completed = [];
    this.save.progress.visited = [];
    this.save.progress.lanternLit = false;
    this.save.flush(true);
    this.ui.setProgress([], [], this.current?.def.id ?? null);
    this.time.tweenTo(6.75, 40);
  }

  static stationDefs() {
    return STATIONS;
  }
}
