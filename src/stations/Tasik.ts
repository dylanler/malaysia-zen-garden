import * as THREE from 'three';
import { Station } from './Station';
import { box, cyl, mat, shadow, flameSprite, glowSprite, slippers } from '../world/props';
import { plankTexture } from '../world/textures';
import { WATER_Y } from '../world/Terrain';
import { JETTY_DECK_Y } from '../world/Path';
import { LAKE_RADIUS } from '../content/stations';
import { haptic, type GlobalHold } from '../core/Interaction';
import { clamp } from '../core/util';

interface Lamp {
  flame: THREE.Sprite;
  glow: THREE.Sprite;
  light: THREE.PointLight | null;
}

interface Jetty {
  shore: THREE.Vector3;
  water: THREE.Vector3;
  postTop: THREE.Vector3;
  /** Where the rope ties on to the sampan, in sampan space. */
  tieLocal: THREE.Vector3;
  rope: THREE.Line;
  ropeGeo: THREE.BufferGeometry;
  lamp: Lamp;
  uShore: number;
  uWater: number;
}

/** Radius at which the seat of the moored sampan sits: the bow tucks under the jetty end. */
const MOOR_R = 38.3;
const DECK_R_SHORE = LAKE_RADIUS + 3.8;
const DECK_R_WATER = LAKE_RADIUS - 0.6;
const ROPE_POINTS = 8;

/**
 * Tasik: the crossing. A sampan waits at the end of the jetty below Jalan Kenangan, carries the
 * player across the lake through the fireflies, and leaves them at the jetty below the kampung.
 */
export class Tasik extends Station {
  private sampan!: THREE.Group;
  private bowLamp!: Lamp;
  private jetties: Jetty[] = [];
  private uTied: [number, number] = [0, 0];
  private boatU = 0;
  private lastBoatU = 0;
  private wakeTimer = 0;
  private dipTimer = 0;
  private cupping = false;
  private cupTime = 0;
  private stayed = false;
  private finaleStarted = false;
  private launched = false;
  private driftToast = false;
  private tangent = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private hold: GlobalHold = {
    hint: 'Hold anywhere to cup your hands',
    onStart: () => this.cup(true),
    onEnd: () => this.cup(false),
  };

  /** The whole lake is the station; the jetties belong to the shore. */
  override score(pos: THREE.Vector3) {
    if (Math.hypot(pos.x, pos.z) < LAKE_RADIUS - 0.6) return 0.3;
    return super.score(pos);
  }

  build() {
    this.center.y = WATER_Y;
    this.group.position.y = WATER_Y;
    this.buildJetties();
    this.buildSampan();
    this.boatU = this.uTied[0];
    this.lastBoatU = this.boatU;
    this.placeSampan(this.boatU, 0);
  }

  // ---------------------------------------------------------------- jetties

  private buildJetties() {
    const path = this.ctx.path;
    const N = 3000;
    type S = { u: number; p: THREE.Vector3; r: number };
    const samples: S[] = [];
    for (let i = 0; i < N; i++) {
      const u = i / N;
      const p = path.getPoint(u, new THREE.Vector3());
      samples.push({ u, p, r: Math.hypot(p.x, p.z) });
    }
    // the only places the path comes this close to the centre are the two jetties
    const runs: S[][] = [];
    let cur: S[] | null = null;
    for (const s of samples) {
      if (s.r >= DECK_R_WATER - 0.6 && s.r <= DECK_R_SHORE + 0.6) {
        if (!cur) {
          cur = [];
          runs.push(cur);
        }
        cur.push(s);
      } else cur = null;
    }
    // mooring points: where the path first dips below MOOR_R, and where it last rises above it
    let firstBelow = -1;
    let lastBelow = -1;
    for (const s of samples) {
      if (s.r < MOOR_R) {
        if (firstBelow < 0) firstBelow = s.u;
        lastBelow = s.u;
      }
    }
    this.uTied = [firstBelow, lastBelow];

    const plank = plankTexture('#a07a4e', '#6a4a2e');
    runs.forEach((run, idx) => {
      const closest = (r: number) => run.reduce((a, b) => (Math.abs(b.r - r) < Math.abs(a.r - r) ? b : a));
      const shoreS = closest(DECK_R_SHORE);
      const waterS = closest(DECK_R_WATER);
      const shore = shoreS.p.clone();
      const water = waterS.p.clone();
      const dir = new THREE.Vector3().subVectors(water, shore);
      dir.y = 0;
      const len = dir.length();
      dir.normalize();
      const perp = new THREE.Vector3(-dir.z, 0, dir.x);
      const yaw = Math.atan2(dir.x, dir.z);

      const deck = box(1.7, 0.1, len + 0.4, '#a07a4e', { map: plank });
      deck.position.copy(shore).add(water).multiplyScalar(0.5);
      deck.position.y = JETTY_DECK_Y - 0.05;
      deck.rotation.y = yaw;
      this.ctx.scene.add(deck);

      // a step where the planks meet the grass
      const step = box(1.7, 0.08, 0.5, '#8d6a44', { map: plank });
      step.position.copy(shore).addScaledVector(dir, -0.4);
      step.position.y = 0.2;
      step.rotation.y = yaw;
      this.ctx.scene.add(step);

      for (let t = 0.4; t < len; t += 1.5) {
        for (const side of [-1, 1]) {
          const p = shore.clone().addScaledVector(dir, t).addScaledVector(perp, side * 0.78);
          const bed = Math.min(this.ctx.terrain.height(p.x, p.z), WATER_Y - 0.3) - 0.3;
          const h = 0.55 - bed;
          const post = cyl(0.07, 0.085, h, 7, '#5e4028');
          post.position.set(p.x, bed + h / 2, p.z);
          this.ctx.scene.add(post);
        }
      }
      // cross beam under the deck
      const beam = box(0.12, 0.12, len, '#5e4028');
      beam.position.copy(deck.position);
      beam.position.y = JETTY_DECK_Y - 0.16;
      beam.rotation.y = yaw;
      this.ctx.scene.add(beam);

      // mooring post with a tin lamp
      const postPos = water.clone().addScaledVector(perp, 0.7).addScaledVector(dir, -0.15);
      const postBed = Math.min(this.ctx.terrain.height(postPos.x, postPos.z), WATER_Y - 0.3) - 0.3;
      const postH = 1.15 - postBed;
      const mpost = cyl(0.08, 0.095, postH, 7, '#5e4028');
      mpost.position.set(postPos.x, postBed + postH / 2, postPos.z);
      this.ctx.scene.add(mpost);
      const postTop = new THREE.Vector3(postPos.x, 1.15, postPos.z);
      const lampG = new THREE.Group();
      const tin = cyl(0.06, 0.055, 0.1, 10, '#b0b4b8', { metalness: 0.4, roughness: 0.5 });
      tin.position.y = 0.05;
      const flame = flameSprite(0.2);
      flame.position.y = 0.2;
      const glow = glowSprite('#ffb060', 1.5, 0);
      glow.position.y = 0.15;
      lampG.add(tin, flame, glow);
      lampG.position.copy(postTop);
      this.ctx.scene.add(lampG);
      const light = this.ctx.quality.low ? null : new THREE.PointLight('#ffb060', 0, 7, 1.8);
      if (light) {
        light.position.copy(postTop).add(new THREE.Vector3(0, 0.25, 0));
        this.ctx.scene.add(light);
      }
      // rope coiled on the deck
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 14), mat('#c9b48a'));
      coil.rotation.x = Math.PI / 2;
      coil.position.copy(water).addScaledVector(perp, -0.5).addScaledVector(dir, -0.7);
      coil.position.y = JETTY_DECK_Y + 0.035;
      this.ctx.scene.add(coil);
      // someone left their slippers at the home jetty
      if (idx === 1) {
        const sl = slippers(0x2f6bb0);
        sl.position.copy(shore).addScaledVector(dir, 0.6).addScaledVector(perp, 0.55);
        sl.position.y = JETTY_DECK_Y;
        sl.rotation.y = yaw + 0.3;
        this.ctx.scene.add(sl);
      }

      const ropeGeo = new THREE.BufferGeometry();
      ropeGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(ROPE_POINTS * 3), 3));
      const rope = new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({ color: '#d8c79f' }));
      rope.frustumCulled = false;
      this.ctx.scene.add(rope);

      // the sampan faces along the path: away from the first jetty, toward the second
      const tieLocal = idx === 0 ? new THREE.Vector3(0.5, 0.3, 1.0) : new THREE.Vector3(-0.5, 0.3, -1.5);
      this.jetties.push({
        shore,
        water,
        postTop,
        tieLocal,
        rope,
        ropeGeo,
        lamp: { flame, glow, light },
        uShore: shoreS.u,
        uWater: waterS.u,
      });
    });
  }

  // ---------------------------------------------------------------- sampan

  private buildSampan() {
    const g = new THREE.Group();
    g.name = 'sampan';
    const hullMat = mat('#5a3a24', { side: THREE.DoubleSide });
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), hullMat);
    shadow(hull);
    hull.scale.set(0.62, 0.58, 2.0);
    hull.position.set(0, 0.3, -0.55);
    g.add(hull);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 30), mat('#7a5232'));
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(0.62, 2.0, 1);
    rim.position.set(0, 0.3, -0.55);
    g.add(rim);
    const floor = box(0.9, 0.03, 3.1, '#6b4a2e');
    floor.position.set(0, 0.03, -0.55);
    g.add(floor);
    for (const z of [-1.6, -0.55, 0.5]) {
      const rib = box(1.0, 0.04, 0.06, '#4a2f1c');
      rib.position.set(0, 0.06, z);
      g.add(rib);
    }
    // the seat is under the player; a second thwart forward
    const seat = box(1.15, 0.05, 0.24, '#8a6340');
    seat.position.set(0, 0.2, 0);
    g.add(seat);
    const fore = box(1.0, 0.05, 0.22, '#8a6340');
    fore.position.set(0, 0.2, -1.6);
    g.add(fore);
    // a paddle laid along the side; the sampan does not need it tonight
    const shaft = cyl(0.018, 0.018, 1.7, 6, '#b08a5a');
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(0.36, 0.24, -1.0);
    g.add(shaft);
    const blade = box(0.14, 0.02, 0.42, '#b08a5a');
    blade.position.set(0.36, 0.24, -2.0);
    g.add(blade);
    // a pelita on a bamboo stick lashed to the bow
    const stick = cyl(0.015, 0.018, 0.75, 5, '#c9b07a');
    stick.position.set(0.26, 0.62, -2.0);
    g.add(stick);
    const tin = cyl(0.05, 0.045, 0.09, 10, '#b0b4b8', { metalness: 0.4, roughness: 0.5 });
    tin.position.set(0.26, 1.02, -2.0);
    g.add(tin);
    const flame = flameSprite(0.2);
    flame.position.set(0.26, 1.15, -2.0);
    const glow = glowSprite('#ffb060', 1.4, 0);
    glow.position.set(0.26, 1.1, -2.0);
    g.add(flame, glow);
    const light = new THREE.PointLight('#ffb060', 0, 6, 1.8);
    light.position.set(0.26, 1.2, -2.0);
    g.add(light);
    this.bowLamp = { flame, glow, light };

    // invisible targets: the water beside you, and the sampan itself when it is tied up
    const waterProxy = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 1.3), mat('#000000'));
    waterProxy.visible = false;
    waterProxy.position.set(1.0, 0.0, -0.35);
    g.add(waterProxy);
    this.add({
      id: 'tasik-water',
      object: waterProxy,
      gestures: ['tap', 'hold'],
      hint: 'Tap the water beside you',
      range: 4,
      markerSize: 0.3,
      enabled: () => this.ctx.locomotion.onWater && !this.ctx.hands.active,
      onTap: () => this.trailHand(),
      onHoldStart: () => this.cup(true),
      onHoldEnd: () => this.cup(false),
    });
    const boardProxy = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 4.2), mat('#000000'));
    boardProxy.visible = false;
    boardProxy.position.set(0, 0.45, -0.55);
    g.add(boardProxy);
    this.add({
      id: 'tasik-sampan',
      object: boardProxy,
      gestures: ['tap'],
      hint: 'Tap the sampan to step in',
      range: 9,
      markerSize: 0.34,
      markerOffset: new THREE.Vector3(0, 0.3, 0),
      enabled: () => this.canBoard(),
      onTap: () => this.board(),
    });

    this.sampan = g;
    this.ctx.scene.add(g);
  }

  private canBoard() {
    const loco = this.ctx.locomotion;
    if (loco.onWater || loco.mode !== 'stroll' || this.ctx.hands.active) return false;
    const j = this.jetties[0];
    if (!j) return false;
    // only from the first jetty, walking toward the water
    return loco.u >= j.uShore - 0.002 && loco.u <= this.uTied[0];
  }

  private board() {
    const loco = this.ctx.locomotion;
    const L = this.ctx.path.length;
    loco.teleport(this.uTied[0] + 0.25 / L);
    loco.faceAlongPath();
    this.ctx.synth.woodKnock(0.5);
    window.setTimeout(() => this.ctx.synth.splash(0.35), 180);
    const stern = this.sampan.localToWorld(this.tmp.set(0, 0, 1.2));
    this.ctx.ripples.spawn(stern.x, WATER_Y, stern.z, 1.6, 2);
    haptic(8);
  }

  private trailHand() {
    const p = this.sampan.localToWorld(this.tmp.set(1.0, 0, -0.35));
    this.ctx.ripples.spawn(p.x, WATER_Y, p.z, 1.2, 1.8);
    this.ctx.synth.splash(0.22);
    haptic(5);
    window.setTimeout(() => this.memory('water'), 700);
  }

  private cup(on: boolean) {
    if (this.cupping === on) return;
    this.cupping = on;
    this.ctx.fireflies.cupTarget = on ? 1 : 0;
    if (on) {
      this.cupTime = 0;
      haptic(4);
    }
  }

  private placeSampan(u: number, time: number) {
    const path = this.ctx.path;
    path.getPoint(u, this.tmp);
    path.getTangent(u, this.tangent);
    const bob = this.ctx.locomotion.reducedMotion ? 0 : Math.sin(performance.now() * 0.0012) * 0.03;
    this.sampan.position.set(this.tmp.x, WATER_Y + bob, this.tmp.z);
    const yaw = Math.atan2(-this.tangent.x, -this.tangent.z);
    this.sampan.rotation.set(Math.sin(time * 0.7) * 0.012, yaw, Math.sin(time * 0.9) * 0.02, 'YXZ');
    this.sampan.updateMatrixWorld();
  }

  private updateRope(j: Jetty, tied: boolean) {
    j.rope.visible = tied;
    if (!tied) return;
    const a = j.postTop;
    const b = this.sampan.localToWorld(this.tmp2.copy(j.tieLocal));
    const pos = j.ropeGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < ROPE_POINTS; i++) {
      const t = i / (ROPE_POINTS - 1);
      const sag = Math.sin(t * Math.PI) * 0.22;
      pos.setXYZ(i, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - sag, a.z + (b.z - a.z) * t);
    }
    pos.needsUpdate = true;
  }

  private updateLamp(l: Lamp, night: number, time: number, seed: number) {
    const on = night;
    (l.flame.material as THREE.SpriteMaterial).opacity = on * (0.8 + Math.sin(time * 15 + seed) * 0.14);
    (l.glow.material as THREE.SpriteMaterial).opacity = on * 0.4;
    if (l.light) l.light.intensity = on * (1.9 + Math.sin(time * 9 + seed) * 0.25);
  }

  override enter() {
    super.enter();
    this.ctx.music.idleEnabled = false;
  }

  override exit() {
    super.exit();
    this.cup(false);
    if (this.ctx.interaction.globalHold === this.hold) this.ctx.interaction.globalHold = null;
    this.ctx.music.idleEnabled = true;
  }

  override reset() {
    super.reset();
    this.stayed = false;
    this.finaleStarted = false;
    this.launched = false;
    this.driftToast = false;
  }

  override update(dt: number, time: number) {
    const loco = this.ctx.locomotion;
    const path = this.ctx.path;
    const L = path.length;
    const onWater = loco.onWater;
    const night = this.ctx.time.night;

    // free roam cannot reach the water: the path takes over at the jetty, and lets go again on the far shore
    if (loco.mode === 'free') {
      for (const j of this.jetties) {
        if (loco.position.distanceTo(j.shore) < 3.6) {
          loco.setMode('stroll');
          this.ctx.ui.toast(
            this.ctx.input.isTouch
              ? 'The sampan only knows the one path. Push the joystick forward to follow it across.'
              : 'The sampan only knows the one path. Hold W to follow it across.',
            7000,
          );
          break;
        }
      }
    } else if (this.ctx.save.settings.locomotion === 'free' && loco.surface === 'land' && !loco.locked) {
      // the player chose free roam; the path only had it on loan for the crossing
      const nearJetty = this.jetties.some((j) => loco.position.distanceTo(j.shore) < 4.4);
      if (!nearJetty) {
        loco.setMode('free');
        this.ctx.ui.toast('Back on land. Wander where you like.');
      }
    }

    // the sampan carries the player across and waits, tied, at either jetty
    this.boatU = clamp(loco.u, this.uTied[0], this.uTied[1]);
    this.placeSampan(this.boatU, time);
    const moved = Math.abs(this.boatU - this.lastBoatU) * L;
    this.lastBoatU = this.boatU;
    if (moved > 0.0005 && onWater) {
      this.wakeTimer -= dt;
      this.dipTimer -= dt;
      if (this.wakeTimer <= 0) {
        this.wakeTimer = 0.6;
        const stern = this.sampan.localToWorld(this.tmp.set((Math.random() - 0.5) * 0.4, 0, 1.3));
        this.ctx.ripples.spawn(stern.x, WATER_Y, stern.z, 2.0, 2.6);
      }
      if (this.dipTimer <= 0) {
        this.dipTimer = 1.5 + Math.random() * 0.7;
        this.ctx.synth.footstep('water');
      }
    } else {
      this.wakeTimer = 0;
      this.dipTimer = 0.5;
    }

    this.jetties.forEach((j, i) => {
      this.updateRope(j, Math.abs(this.boatU - this.uTied[i]) * L < 0.3);
      this.updateLamp(j.lamp, night, time, i * 3.1);
    });
    this.updateLamp(this.bowLamp, night, time, 1.7);

    if (!this.active) return;

    if (onWater && !this.finaleStarted) {
      this.finaleStarted = true;
      this.ctx.music.startFinale();
    }
    // the sampan finds its own way to the middle of the lake
    if (onWater && !this.launched) {
      this.launched = true;
      if (loco.mode === 'stroll' && !loco.autoWalk) loco.autoWalkToNext();
    }
    if (this.launched && !this.driftToast && onWater && !loco.autoWalk && Math.abs(loco.u - path.stationU.tasik) * L < 1.6) {
      this.driftToast = true;
      window.setTimeout(() => {
        if (this.active) this.ctx.ui.toast('Drift here as long as you like. Hold the round button (or W) when you are ready to go on.', 8000);
      }, 2500);
    }

    // cupped hands, once it is dark enough to see them
    const wantHold = onWater && night > 0.3 && !this.ctx.hands.active;
    if (wantHold && this.ctx.interaction.globalHold !== this.hold) this.ctx.interaction.globalHold = this.hold;
    else if (!wantHold && this.ctx.interaction.globalHold === this.hold) this.ctx.interaction.globalHold = null;

    if (this.cupping) {
      this.cupTime += dt;
      if (!this.stayed && this.cupTime > 2.4 && this.ctx.fireflies.cup > 0.6) {
        const hand = loco.handPosition(this.tmp);
        if (this.ctx.fireflies.nearCount(hand, 10) > 0) {
          this.stayed = true;
          haptic(12);
          this.ctx.music.play('plink', 12, 0.3);
          this.complete('fireflies');
        }
      }
    }
  }
}
