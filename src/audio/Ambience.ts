import * as THREE from 'three';
import type { AudioEngine } from './AudioEngine';
import type { Synth } from './Synth';
import type { Music } from './Music';
import type { Weather } from '../core/Weather';
import type { ZoneId } from '../content/stations';
import { clamp, smoothstep } from '../core/util';

type LayerName = 'wind' | 'leaves' | 'water' | 'spray' | 'rain' | 'roof' | 'cicada' | 'crickets' | 'lap' | 'hum' | 'fan' | 'drain';

type EventName = 'dove' | 'pipit' | 'frogs' | 'hornbill' | 'owl' | 'thunder' | 'clock' | 'mahjong' | 'drips' | 'sape' | 'radio' | 'distantGongs' | 'whistle' | 'horn' | 'padiBirds';

interface Layer {
  gain: GainNode;
  target: number;
}

interface Ev {
  next: number;
  interval: [number, number];
  level: number; // 0..1 chance/volume scaler per zone
  fire: (level: number) => void;
}

interface Emitter {
  layer: LayerName;
  pos: THREE.Vector3;
  radius: number;
  gain: number;
}

type ZonePreset = Partial<Record<LayerName, number>> & { events?: Partial<Record<EventName, number>> };

const ZONES: Record<ZoneId, ZonePreset> = {
  rumah: { wind: 0.22, leaves: 0.3, crickets: 0.5, events: { dove: 1, radio: 0.7, frogs: 0.3, owl: 0.4 } },
  padang: { wind: 0.55, leaves: 0.18, events: { dove: 0.4, padiBirds: 0.3 } },
  airterjun: { wind: 0.12, leaves: 0.4, cicada: 0.7, events: { hornbill: 1, drips: 0.8 } },
  wakaf: { wind: 0.2, leaves: 0.3, cicada: 0.35, events: { frogs: 0.6, drips: 0.5 } },
  sawah: { wind: 0.6, leaves: 0.22, events: { pipit: 1, frogs: 0.5, distantGongs: 0.5, padiBirds: 1 } },
  panjai: { wind: 0.25, leaves: 0.2, lap: 0.32, crickets: 0.4, events: { hornbill: 0.7, sape: 0.8, frogs: 0.5 } },
  jalan: { wind: 0.1, leaves: 0.05, hum: 0.14, fan: 0.18, crickets: 0.25, events: { clock: 1, mahjong: 0.7, whistle: 0.35, horn: 0.25 } },
  tasik: { wind: 0.14, lap: 0.5, crickets: 0.55, events: { frogs: 0.8, owl: 0.6 } },
};

export class Ambience {
  zone: ZoneId = 'rumah';
  emitters: Emitter[] = [];
  /** 0..1, raised while sitting: opens the detail layer. */
  focus = 0;
  private layers = new Map<LayerName, Layer>();
  private events = new Map<EventName, Ev>();
  private built = false;
  private throttle = 0;
  private hour = 7;
  private night = 0;
  private playerPos = new THREE.Vector3();
  private cicadaSwell = 0.5;
  private cicadaSwellTarget = 0.5;
  private cicadaGainNode: GainNode | null = null;
  private roofDripTimer = 0;

  constructor(private e: AudioEngine, private synth: Synth, private music: Music, private weather: Weather) {
    e.whenReady(() => this.build());
  }

  private layer(name: LayerName, chain: () => AudioNode, bus: 'ambience' | 'weather' = 'ambience', reverb = 0) {
    const g = this.e.gain(0.0001);
    const src = chain();
    src.connect(g);
    this.e.out(g, bus, reverb);
    this.layers.set(name, { gain: g, target: 0 });
  }

  private build() {
    const e = this.e;
    const ctx = e.ctx!;
    this.built = true;

    this.layer('wind', () => {
      const n = e.noiseSource('brown');
      const lp = e.filter('lowpass', 420, 0.6);
      const lfo = e.osc('sine', 0.09);
      const lfoG = e.gain(220);
      lfo.connect(lfoG);
      lfoG.connect(lp.frequency);
      lfo.start();
      n.connect(lp);
      return lp;
    });

    this.layer('leaves', () => {
      const n = e.noiseSource('white');
      const hp = e.filter('highpass', 1600, 0.7);
      const bp = e.filter('bandpass', 3400, 0.6);
      const am = e.gain(0.5);
      const lfo = e.osc('sine', 0.23);
      const lfoG = e.gain(0.35);
      const lfo2 = e.osc('sine', 0.61);
      const lfoG2 = e.gain(0.15);
      lfo.connect(lfoG);
      lfo2.connect(lfoG2);
      lfoG.connect(am.gain);
      lfoG2.connect(am.gain);
      lfo.start();
      lfo2.start();
      n.connect(hp);
      hp.connect(bp);
      bp.connect(am);
      return am;
    });

    this.layer(
      'water',
      () => {
        const n = e.noiseSource('pink');
        const bp = e.filter('bandpass', 620, 0.45);
        const lp = e.filter('lowpass', 3200, 0.5);
        n.connect(bp);
        bp.connect(lp);
        return lp;
      },
      'ambience',
      0.25,
    );

    this.layer('spray', () => {
      const n = e.noiseSource('white');
      const hp = e.filter('highpass', 3800, 0.6);
      n.connect(hp);
      return hp;
    });

    this.layer(
      'drain',
      () => {
        const n = e.noiseSource('pink');
        const bp = e.filter('bandpass', 1400, 1.2);
        const am = e.gain(0.6);
        const lfo = e.osc('sine', 1.7);
        const lfoG = e.gain(0.3);
        lfo.connect(lfoG);
        lfoG.connect(am.gain);
        lfo.start();
        n.connect(bp);
        bp.connect(am);
        return am;
      },
      'ambience',
      0.1,
    );

    this.layer(
      'rain',
      () => {
        const n = e.noiseSource('white');
        const hp = e.filter('highpass', 800, 0.5);
        const lp = e.filter('lowpass', 7000, 0.5);
        n.connect(hp);
        hp.connect(lp);
        return lp;
      },
      'weather',
    );

    this.layer(
      'roof',
      () => {
        const n = e.noiseSource('white');
        const bp = e.filter('bandpass', 2400, 5);
        const bp2 = e.filter('bandpass', 3900, 7);
        const mix = e.gain(1);
        n.connect(bp);
        n.connect(bp2);
        bp.connect(mix);
        bp2.connect(mix);
        return mix;
      },
      'weather',
      0.35,
    );

    this.layer('cicada', () => {
      const n = e.noiseSource('white');
      const bp = e.filter('bandpass', 5200, 9);
      const am = e.gain(0.5);
      const lfo = e.osc('sine', 41);
      const lfoG = e.gain(0.5);
      lfo.connect(lfoG);
      lfoG.connect(am.gain);
      lfo.start();
      n.connect(bp);
      bp.connect(am);
      this.cicadaGainNode = e.gain(0.5);
      am.connect(this.cicadaGainNode);
      return this.cicadaGainNode;
    });

    this.layer('crickets', () => {
      const mix = e.gain(1);
      [4300, 4750, 5200].forEach((f, i) => {
        const o = e.osc('sine', f);
        const gate = e.gain(0);
        const lfo = e.osc('square', 21 + i * 3);
        const lfoG = e.gain(0.5);
        const offset = ctx.createConstantSource();
        offset.offset.value = 0.5;
        lfo.connect(lfoG);
        lfoG.connect(gate.gain);
        offset.connect(gate.gain);
        lfo.start();
        offset.start();
        const chirp = e.gain(0);
        o.connect(gate);
        gate.connect(chirp);
        chirp.connect(mix);
        o.start();
        // chirp bursts
        const schedule = () => {
          if (!e.ctx) return;
          const t = e.now + Math.random() * 1.5 + 0.2;
          const dur = 0.25 + Math.random() * 0.5;
          chirp.gain.setTargetAtTime(0.09, t, 0.03);
          chirp.gain.setTargetAtTime(0.0001, t + dur, 0.05);
          window.setTimeout(schedule, (t + dur - e.now) * 1000 + 600 + Math.random() * 2200);
        };
        window.setTimeout(schedule, 500 + i * 400);
      });
      return mix;
    });

    this.layer(
      'lap',
      () => {
        const n = e.noiseSource('brown');
        const bp = e.filter('bandpass', 380, 0.8);
        const am = e.gain(0.5);
        const lfo = e.osc('sine', 0.31);
        const lfoG = e.gain(0.4);
        lfo.connect(lfoG);
        lfoG.connect(am.gain);
        lfo.start();
        n.connect(bp);
        bp.connect(am);
        return am;
      },
      'ambience',
      0.2,
    );

    this.layer('hum', () => {
      const o = e.osc('sawtooth', 55);
      const o2 = e.osc('sawtooth', 110.5);
      const lp = e.filter('lowpass', 240, 0.8);
      const g = e.gain(0.25);
      o.connect(lp);
      o2.connect(lp);
      lp.connect(g);
      o.start();
      o2.start();
      return g;
    });

    this.layer('fan', () => {
      const n = e.noiseSource('pink');
      const bp = e.filter('bandpass', 700, 1.2);
      const am = e.gain(0.5);
      const lfo = e.osc('sine', 1.15);
      const lfoG = e.gain(0.45);
      lfo.connect(lfoG);
      lfoG.connect(am.gain);
      lfo.start();
      n.connect(bp);
      bp.connect(am);
      return am;
    });

    // ---------------- scheduled events
    const ev = (name: EventName, interval: [number, number], fire: (level: number) => void) =>
      this.events.set(name, { next: e.now + interval[0] * Math.random(), interval, level: 0, fire });

    ev('dove', [7, 16], (lv) => this.dove(lv));
    ev('pipit', [5, 12], (lv) => this.pipit(lv));
    ev('padiBirds', [9, 20], (lv) => this.pipit(lv * 0.6));
    ev('frogs', [2.5, 7], (lv) => this.frog(lv));
    ev('hornbill', [28, 55], (lv) => this.hornbill(lv));
    ev('owl', [22, 50], (lv) => this.owl(lv));
    ev('thunder', [16, 40], (lv) => this.thunder(lv));
    ev('clock', [1, 1], (lv) => this.tick(lv));
    ev('mahjong', [4, 11], (lv) => this.mahjong(lv));
    ev('drips', [0.6, 2.4], (lv) => this.drip(lv));
    ev('sape', [14, 30], (lv) => this.music.phrase('sape', lv * 0.9, 3 + Math.floor(Math.random() * 3)));
    ev('radio', [11, 24], (lv) => this.music.phrase('radio', lv * 0.8, 3 + Math.floor(Math.random() * 4)));
    ev('distantGongs', [16, 34], (lv) => this.synth.gong(scaleLow(Math.floor(Math.random() * 3)), lv * 0.25, 'ambience', { decay: 4 }));
    ev('whistle', [40, 90], () => this.synth.whistle(1.4 + Math.random()));
    ev('horn', [50, 120], () => this.synth.horn());

    function scaleLow(i: number) {
      return [73.4, 82.4, 110][i];
    }

    this.applyZone();
  }

  // ---------------- event voices

  private dove(level: number) {
    if (!this.e.ready) return;
    const ctx = this.e.ctx!;
    const t0 = ctx.currentTime;
    const base = 480 + Math.random() * 60;
    const out = this.e.gain(0.11 * level);
    this.e.out(out, 'ambience', 0.5);
    const pattern = [
      [0, 0.16],
      [0.26, 0.16],
      [0.52, 0.55],
    ];
    for (const [dt, dur] of pattern) {
      const o = this.e.osc('sine', base);
      const vib = this.e.osc('sine', 28);
      const vibG = this.e.gain(9);
      vib.connect(vibG);
      vibG.connect(o.frequency);
      const g = this.e.gain(0);
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(1, t0 + dt + 0.04);
      g.gain.setValueAtTime(1, t0 + dt + dur - 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + dur);
      o.frequency.setValueAtTime(base * 1.05, t0 + dt);
      o.frequency.exponentialRampToValueAtTime(base * (dur > 0.3 ? 0.92 : 1), t0 + dt + dur);
      o.connect(g);
      g.connect(out);
      o.start(t0 + dt);
      vib.start(t0 + dt);
      o.stop(t0 + dt + dur + 0.05);
      vib.stop(t0 + dt + dur + 0.05);
    }
  }

  private pipit(level: number) {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    const n = 3 + Math.floor(Math.random() * 5);
    const out = this.e.gain(0.05 * level);
    this.e.out(out, 'ambience', 0.4);
    for (let i = 0; i < n; i++) {
      const dt = i * (0.09 + Math.random() * 0.08);
      const f = 3200 + Math.random() * 1400;
      const o = this.e.osc('sine', f);
      o.frequency.setValueAtTime(f * 1.25, t0 + dt);
      o.frequency.exponentialRampToValueAtTime(f * 0.85, t0 + dt + 0.07);
      const g = this.e.gain(0);
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(1, t0 + dt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.08);
      o.connect(g);
      g.connect(out);
      o.start(t0 + dt);
      o.stop(t0 + dt + 0.1);
    }
  }

  private frog(level: number) {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    const f = 150 + Math.random() * 90;
    const o = this.e.osc('sine', f);
    const o2 = this.e.osc('square', f * 2);
    const lp = this.e.filter('lowpass', 700, 1);
    const g = this.e.gain(0);
    const g2 = this.e.gain(0.08);
    o.frequency.setValueAtTime(f * 1.2, t0);
    o.frequency.exponentialRampToValueAtTime(f * 0.85, t0 + 0.2);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09 * level, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    o.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(lp);
    this.e.out(lp, 'ambience', 0.5);
    o.start(t0);
    o2.start(t0);
    o.stop(t0 + 0.3);
    o2.stop(t0 + 0.3);
  }

  private hornbill(level: number) {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    const out = this.e.gain(0.09 * level);
    this.e.out(out, 'ambience', 0.6);
    for (let i = 0; i < 3; i++) {
      const dt = i * 0.42;
      const o = this.e.osc('sawtooth', 330);
      const lp = this.e.filter('lowpass', 900, 1);
      const g = this.e.gain(0);
      o.frequency.setValueAtTime(300, t0 + dt);
      o.frequency.exponentialRampToValueAtTime(380, t0 + dt + 0.1);
      o.frequency.exponentialRampToValueAtTime(280, t0 + dt + 0.25);
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(1, t0 + dt + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.28);
      o.connect(lp);
      lp.connect(g);
      g.connect(out);
      o.start(t0 + dt);
      o.stop(t0 + dt + 0.3);
    }
    // wingbeats
    for (let i = 0; i < 5; i++) {
      const dt = 1.6 + i * 0.28;
      const n = this.e.noiseSource('pink');
      const lp = this.e.filter('lowpass', 500, 0.8);
      const g = this.e.gain(0);
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.4 * level, t0 + dt + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.2);
      n.connect(lp);
      lp.connect(g);
      this.e.out(g, 'ambience', 0.2);
      n.stop(t0 + dt + 0.25);
    }
  }

  private owl(level: number) {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    const out = this.e.gain(0.07 * level);
    this.e.out(out, 'ambience', 0.7);
    for (const [dt, f, dur] of [
      [0, 420, 0.25],
      [0.4, 380, 0.5],
    ] as [number, number, number][]) {
      const o = this.e.osc('sine', f);
      const g = this.e.gain(0);
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(1, t0 + dt + 0.06);
      g.gain.setValueAtTime(1, t0 + dt + dur - 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + dur);
      o.connect(g);
      g.connect(out);
      o.start(t0 + dt);
      o.stop(t0 + dt + dur + 0.05);
    }
  }

  private thunder(level: number) {
    if (!this.e.ready) return;
    const t0 = this.e.now + Math.random() * 0.5;
    const n = this.e.noiseSource('brown');
    const lp = this.e.filter('lowpass', 110 + Math.random() * 60, 0.7);
    const g = this.e.gain(0);
    const dur = 2.5 + Math.random() * 2.5;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.7 * level, t0 + 0.4 + Math.random() * 0.6);
    g.gain.exponentialRampToValueAtTime(0.25 * level, t0 + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    n.connect(lp);
    lp.connect(g);
    this.e.out(g, 'weather', 0.8);
    n.stop(t0 + dur + 0.1);
  }

  private tick(level: number) {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    const n = this.e.noiseSource('white');
    const bp = this.e.filter('bandpass', 2800, 6);
    const g = this.e.gain(0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.06 * level, t0 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
    n.connect(bp);
    bp.connect(g);
    this.e.out(g, 'ambience', 0.1);
    n.stop(t0 + 0.05);
  }

  private mahjong(level: number) {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    const k = 3 + Math.floor(Math.random() * 6);
    for (let i = 0; i < k; i++) {
      const dt = i * (0.05 + Math.random() * 0.12);
      const n = this.e.noiseSource('white');
      const bp = this.e.filter('bandpass', 1500 + Math.random() * 900, 4);
      const lp = this.e.filter('lowpass', 900, 1);
      const g = this.e.gain(0);
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.08 * level, t0 + dt + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.05);
      n.connect(bp);
      bp.connect(lp);
      lp.connect(g);
      this.e.out(g, 'ambience', 0.3);
      n.stop(t0 + dt + 0.08);
    }
  }

  private drip(level: number) {
    if (!this.e.ready) return;
    const f = 1500 + Math.random() * 1800;
    const t0 = this.e.now;
    const o = this.e.osc('sine', f * 1.6);
    o.frequency.exponentialRampToValueAtTime(f, t0 + 0.03);
    const g = this.e.gain(0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.05 * level, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    o.connect(g);
    this.e.out(g, 'ambience', 0.6);
    o.start(t0);
    o.stop(t0 + 0.3);
  }

  // ---------------- control

  setZone(zone: ZoneId) {
    if (this.zone === zone) return;
    this.zone = zone;
    this.applyZone();
  }

  private applyZone() {
    if (!this.built) return;
    const preset = ZONES[this.zone];
    for (const [name, layer] of this.layers) layer.target = preset[name] ?? 0;
    for (const [name, ev] of this.events) ev.level = preset.events?.[name] ?? 0;
  }

  setTime(hour: number, night: number) {
    this.hour = hour;
    this.night = night;
  }

  setListener(pos: THREE.Vector3) {
    this.playerPos.copy(pos);
  }

  update(dt: number) {
    if (!this.built || !this.e.ready) return;
    const now = this.e.now;
    this.throttle -= dt;

    // cicada swells
    this.cicadaSwell += (this.cicadaSwellTarget - this.cicadaSwell) * Math.min(1, dt * 0.35);
    if (Math.random() < dt * 0.12) this.cicadaSwellTarget = 0.25 + Math.random() * 0.75;

    if (this.throttle <= 0) {
      this.throttle = 0.12;
      const day = 1 - this.night;
      const dawnish = smoothstep(5.5, 7, this.hour) * (1 - smoothstep(10.5, 12.5, this.hour));
      const duskish = smoothstep(17, 18.5, this.hour) * (1 - smoothstep(19.5, 21, this.hour));
      const rain = this.weather.rain;
      const sheltered = this.weather.sheltered;
      const focusBoost = 1 + this.focus * 0.25;
      for (const [name, layer] of this.layers) {
        let v = layer.target;
        // emitters can raise a layer regardless of zone
        for (const em of this.emitters) {
          if (em.layer !== name) continue;
          const d = em.pos.distanceTo(this.playerPos);
          const f = Math.pow(clamp(1 - (d - 2) / em.radius, 0, 1), 1.6);
          v = Math.max(v, em.gain * f);
        }
        switch (name) {
          case 'cicada':
            v *= (0.35 + 0.65 * this.cicadaSwell) * clamp(day * 1.2, 0, 1) * (1 - rain * 0.7);
            break;
          case 'crickets':
            v *= clamp(this.night * 1.1 + duskish * 0.6, 0, 1);
            v = Math.max(v, this.night * 0.25 * (this.zone === 'jalan' ? 0.4 : 1));
            break;
          case 'rain':
            v = rain * (sheltered ? 0.55 : 1);
            break;
          case 'roof':
            v = rain * (sheltered ? 0.9 : 0.12);
            break;
          case 'leaves':
            v *= 1 - rain * 0.5;
            v *= focusBoost;
            break;
          case 'wind':
            v *= 1 + rain * 0.4;
            break;
          case 'spray':
          case 'drain':
            v *= focusBoost;
            break;
          default:
            break;
        }
        v = clamp(v, 0, 1);
        layer.gain.gain.setTargetAtTime(Math.max(0.0001, v), now, 0.9);
      }
      // events
      for (const [name, ev] of this.events) {
        let lv = ev.level;
        if (name === 'dove') lv *= dawnish + 0.15 * (1 - this.night);
        if (name === 'pipit' || name === 'padiBirds') lv *= (1 - this.night) * (1 - rain);
        if (name === 'frogs') lv *= clamp(this.night + this.weather.wetness * 0.8 + duskish * 0.5, 0, 1);
        if (name === 'owl') lv *= this.night;
        if (name === 'hornbill') lv *= (1 - this.night) * (1 - rain * 0.8);
        if (name === 'thunder') lv = rain > 0.25 ? 0.6 + rain * 0.4 : 0;
        if (name === 'drips') lv = Math.max(lv, sheltered && rain > 0.2 ? 1 : 0) * (1 + this.focus);
        if (name === 'sape') lv *= 1 - this.night * 0.4;
        if (name === 'radio') lv *= 1 - this.night * 0.5;
        if (now >= ev.next) {
          if (lv > 0.02 && Math.random() < 0.6 + lv * 0.4) ev.fire(lv);
          const [a, b] = ev.interval;
          ev.next = now + (a + Math.random() * (b - a)) / Math.max(0.35, lv > 0 ? 1 : 0.35);
        }
      }
    }

    // random roof drips ping a little faster under the roof
    if (this.weather.sheltered && this.weather.rain > 0.3) {
      this.roofDripTimer -= dt;
      if (this.roofDripTimer <= 0) {
        this.roofDripTimer = 0.15 + Math.random() * 0.6;
        this.drip(0.5);
      }
    }
  }
}
