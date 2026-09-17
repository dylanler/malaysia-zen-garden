import type { AudioEngine } from './AudioEngine';
import type { Synth } from './Synth';

/** D major pentatonic: D E F# A B. One scale for every instrument in the garden. */
const ROOT = 146.83; // D3
const DEGREES = [0, 2, 4, 7, 9]; // semitones

export type InstrumentName = 'gamelan' | 'gongs' | 'engkerumong' | 'zither' | 'veena' | 'plink' | 'radio' | 'sape';

export function scaleFreq(index: number, octaveShift = 0) {
  const oct = Math.floor(index / DEGREES.length) + octaveShift;
  const deg = ((index % DEGREES.length) + DEGREES.length) % DEGREES.length;
  return ROOT * Math.pow(2, oct + DEGREES[deg] / 12);
}

/** Wanders the scale in small steps so idle phrases sound intentional. */
export class MelodicWalker {
  index = 5;
  constructor(private lo = 0, private hi = 14) {}
  next() {
    const r = Math.random();
    let step = r < 0.15 ? 0 : r < 0.5 ? 1 : r < 0.8 ? -1 : r < 0.9 ? 2 : r < 0.97 ? -2 : 5;
    if (Math.random() < 0.5 && step === 5) step = -5;
    this.index += step;
    if (this.index < this.lo) this.index = this.lo + 2;
    if (this.index > this.hi) this.index = this.hi - 2;
    return this.index;
  }
}

export class Music {
  private walker = new MelodicWalker(2, 14);
  private idleTimer = 0;
  private nextIdle = 18;
  instrument: InstrumentName | null = null;
  /** When false, idle phrases are silent (e.g. during the finale). */
  idleEnabled = true;
  private finaleEvents: { t: number; inst: InstrumentName; idx: number; vel: number }[] = [];
  private finaleTime = -1;

  constructor(private e: AudioEngine, private synth: Synth) {}

  /** Play one note of an instrument. index is a scale index (0 = root); octave shifts the whole thing. */
  play(inst: InstrumentName, index: number, vel = 1) {
    if (!this.e.ready) return;
    switch (inst) {
      case 'gamelan':
        this.synth.gamelan(scaleFreq(index, 1), vel);
        break;
      case 'gongs':
        this.synth.gong(scaleFreq(index, -1), vel);
        break;
      case 'engkerumong':
        this.synth.engkerumong(scaleFreq(index, 1), vel);
        break;
      case 'zither':
        this.synth.pluck(scaleFreq(index, 1), vel, 'music', 'bright');
        break;
      case 'veena':
        this.synth.pluck(scaleFreq(index, 0), vel, 'music', 'nasal');
        break;
      case 'plink':
        this.synth.plink(scaleFreq(index, 2), vel);
        break;
      case 'radio':
        this.synth.radio(scaleFreq(index, 1), vel);
        break;
      case 'sape':
        this.synth.pluck(scaleFreq(index, 0), vel * 0.5, 'ambience', 'soft');
        break;
    }
  }

  /** Next note from the walker on the given instrument. */
  step(inst: InstrumentName, vel = 1) {
    const idx = this.walker.next();
    this.play(inst, idx, vel);
    return idx;
  }

  /** Short 2-4 note phrase, spaced in time. */
  phrase(inst: InstrumentName, vel = 0.5, notes = 2 + Math.floor(Math.random() * 3)) {
    let delay = 0;
    for (let i = 0; i < notes; i++) {
      const gap = 380 + Math.random() * 520;
      window.setTimeout(() => this.step(inst, vel * (0.7 + Math.random() * 0.3)), delay);
      delay += gap;
    }
  }

  update(dt: number) {
    if (this.instrument && this.idleEnabled && this.finaleTime < 0) {
      this.idleTimer += dt;
      if (this.idleTimer > this.nextIdle) {
        this.idleTimer = 0;
        this.nextIdle = 20 + Math.random() * 25;
        this.phrase(this.instrument, 0.32);
      }
    }
    if (this.finaleTime >= 0) {
      this.finaleTime += dt;
      while (this.finaleEvents.length && this.finaleEvents[0].t <= this.finaleTime) {
        const ev = this.finaleEvents.shift()!;
        this.play(ev.inst, ev.idx, ev.vel);
      }
      if (this.finaleEvents.length === 0) this.finaleTime = -1;
    }
  }

  /** Start the lake-crossing arrangement: each culture's instrument enters in turn, then together. */
  startFinale() {
    const ev: { t: number; inst: InstrumentName; idx: number; vel: number }[] = [];
    const push = (t: number, inst: InstrumentName, idx: number, vel = 0.5) => ev.push({ t, inst, idx, vel });
    // gamelan opens
    [0, 1.2, 2.2, 3.6].forEach((t, i) => push(2 + t, 'gamelan', [5, 7, 6, 9][i], 0.45));
    // zither answers
    [0, 0.9, 1.7, 2.9].forEach((t, i) => push(8 + t, 'zither', [10, 9, 7, 5][i], 0.4));
    // veena
    [0, 1.4, 2.6].forEach((t, i) => push(14 + t, 'veena', [5, 6, 7][i], 0.4));
    // gongs underneath
    [0, 3.5, 7].forEach((t, i) => push(18 + t, 'gongs', [0, 3, 0][i], 0.5));
    // engkerumong ripples
    [0, 0.35, 0.7, 1.05, 1.4, 2.1].forEach((t, i) => push(24 + t, 'engkerumong', [10, 11, 12, 11, 10, 9][i], 0.35));
    // together
    const chord = [
      ['gamelan', 5],
      ['zither', 9],
      ['veena', 7],
      ['engkerumong', 12],
      ['gongs', 0],
    ] as [InstrumentName, number][];
    [0, 6, 12].forEach((t) => chord.forEach(([inst, idx], i) => push(30 + t + i * 0.18, inst, idx, 0.42)));
    [0, 1.5, 3, 4.5].forEach((t, i) => push(46 + t, 'gamelan', [9, 7, 6, 5][i], 0.4));
    push(52, 'gongs', 0, 0.55);
    this.finaleEvents = ev.sort((a, b) => a.t - b.t);
    this.finaleTime = 0;
  }

  stopFinale() {
    this.finaleEvents = [];
    this.finaleTime = -1;
  }

  get finaleRunning() {
    return this.finaleTime >= 0;
  }
}
