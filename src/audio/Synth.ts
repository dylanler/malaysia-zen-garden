import type { AudioEngine, BusName } from './AudioEngine';

/**
 * Instrument and effect one-shots. Every pitched instrument in the garden is fed notes from
 * one shared pentatonic scale (see Music.ts), so anything you play is consonant with anything else.
 */
export class Synth {
  constructor(private e: AudioEngine) {}

  private get ctx() {
    return this.e.ctx!;
  }

  private env(g: GainNode, t0: number, attack: number, peak: number, decay: number, sustainTo = 0.0001) {
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
    g.gain.exponentialRampToValueAtTime(sustainTo, t0 + attack + decay);
  }

  private stopAt(nodes: AudioScheduledSourceNode[], t: number) {
    for (const n of nodes) {
      try {
        n.stop(t);
      } catch {
        /* already stopped */
      }
    }
  }

  // ------------------------------------------------------------ pitched

  /** Hanging gong: inharmonic partials, slow bloom, long tail, gentle beating. */
  gong(freq: number, vel = 1, bus: BusName = 'music', opts: { decay?: number; bright?: number } = {}) {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    const decay = opts.decay ?? 5.5;
    const bright = opts.bright ?? 1;
    const partials = [1, 1.52, 2.02, 2.71, 3.6, 4.3];
    const gains = [1, 0.5, 0.36, 0.22 * bright, 0.12 * bright, 0.07 * bright];
    const out = this.e.gain(0.32 * vel);
    this.e.out(out, bus, 0.5);
    const srcs: AudioScheduledSourceNode[] = [];
    partials.forEach((p, i) => {
      for (const det of [0.9985, 1.0015]) {
        const o = this.e.osc('sine', freq * p * det);
        const g = this.e.gain(0);
        const d = decay * (1 - i * 0.13);
        this.env(g, t0, 0.012 + i * 0.004, gains[i] * 0.5, d);
        o.connect(g);
        g.connect(out);
        o.start(t0);
        srcs.push(o);
      }
    });
    // strike transient
    const n = this.e.noiseSource('white');
    const nf = this.e.filter('bandpass', freq * 5, 2);
    const ng = this.e.gain(0);
    this.env(ng, t0, 0.003, 0.25 * vel, 0.06);
    n.connect(nf);
    nf.connect(ng);
    ng.connect(out);
    srcs.push(n);
    this.stopAt(srcs, t0 + decay + 0.5);
  }

  /** Malay gamelan (saron/gambang): metallic FM with a quick shimmer and medium tail. */
  gamelan(freq: number, vel = 1, bus: BusName = 'music') {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    const out = this.e.gain(0.28 * vel);
    this.e.out(out, bus, 0.4);
    const srcs: AudioScheduledSourceNode[] = [];
    for (const [ratio, gain, decay] of [
      [1, 1, 2.4],
      [1.006, 0.5, 2.0],
      [2.02, 0.22, 1.2],
      [3.97, 0.08, 0.5],
    ] as [number, number, number][]) {
      const car = this.e.osc('sine', freq * ratio);
      const mod = this.e.osc('sine', freq * ratio * 1.41);
      const modGain = this.e.gain(freq * ratio * 2.2);
      modGain.gain.setValueAtTime(freq * ratio * 2.2, t0);
      modGain.gain.exponentialRampToValueAtTime(1, t0 + 0.35);
      mod.connect(modGain);
      modGain.connect(car.frequency);
      const g = this.e.gain(0);
      this.env(g, t0, 0.004, gain * 0.5, decay);
      car.connect(g);
      g.connect(out);
      car.start(t0);
      mod.start(t0);
      srcs.push(car, mod);
    }
    this.stopAt(srcs, t0 + 3);
  }

  /** Iban engkerumong: small gongs in a row, brighter and shorter than the big set. */
  engkerumong(freq: number, vel = 1, bus: BusName = 'music') {
    this.gong(freq, vel * 0.8, bus, { decay: 1.7, bright: 1.6 });
  }

  /** Plucked string (additive; works at any pitch). tone: 'bright' (zither-like) or 'nasal' (veena-like). */
  pluck(freq: number, vel = 1, bus: BusName = 'music', tone: 'bright' | 'nasal' | 'soft' = 'bright') {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    const out = this.e.gain(0.26 * vel);
    this.e.out(out, bus, tone === 'soft' ? 0.5 : 0.3);
    const lp = this.e.filter('lowpass', tone === 'soft' ? 1800 : 6000, 0.7);
    lp.connect(out);
    const srcs: AudioScheduledSourceNode[] = [];
    const harm = tone === 'nasal' ? [1, 0.55, 0.9, 0.5, 0.3, 0.2] : tone === 'soft' ? [1, 0.4, 0.15, 0.06] : [1, 0.62, 0.4, 0.3, 0.18, 0.12, 0.08];
    const dec = [2.6, 1.7, 1.2, 0.9, 0.7, 0.5, 0.4];
    harm.forEach((h, i) => {
      const o = this.e.osc('sine', freq * (i + 1) * (1 + i * 0.0006));
      if (tone === 'nasal') {
        o.frequency.setValueAtTime(freq * (i + 1) * 0.975, t0);
        o.frequency.exponentialRampToValueAtTime(freq * (i + 1), t0 + 0.09);
      }
      const g = this.e.gain(0);
      this.env(g, t0, 0.003, h * 0.45, dec[i] * (tone === 'nasal' ? 1.3 : 1));
      o.connect(g);
      g.connect(lp);
      o.start(t0);
      srcs.push(o);
    });
    // pick noise
    const n = this.e.noiseSource('white');
    const nf = this.e.filter('bandpass', 2500, 1.2);
    const ng = this.e.gain(0);
    this.env(ng, t0, 0.001, 0.12 * vel, 0.03);
    n.connect(nf);
    nf.connect(ng);
    ng.connect(out);
    srcs.push(n);
    this.stopAt(srcs, t0 + 3.6);
  }

  /** Water plink: a short pitched drop. */
  plink(freq: number, vel = 1, bus: BusName = 'sfx') {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    const o = this.e.osc('sine', freq * 1.7);
    o.frequency.exponentialRampToValueAtTime(freq, t0 + 0.045);
    const g = this.e.gain(0);
    this.env(g, t0, 0.004, 0.3 * vel, 0.5);
    o.connect(g);
    this.e.out(g, bus, 0.4);
    o.start(t0);
    o.stop(t0 + 0.7);
  }

  /** Muffled radio in another room: a lowpassed triangle. */
  radio(freq: number, vel = 1, bus: BusName = 'ambience') {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    const o = this.e.osc('triangle', freq);
    const lp = this.e.filter('lowpass', 900, 0.8);
    const g = this.e.gain(0);
    this.env(g, t0, 0.02, 0.09 * vel, 0.55);
    o.connect(lp);
    lp.connect(g);
    this.e.out(g, bus, 0.2);
    o.start(t0);
    o.stop(t0 + 0.8);
  }

  /** Two-note completion chime. */
  chime(freqA: number, freqB: number) {
    this.gamelan(freqA, 0.6);
    setTimeout(() => this.gamelan(freqB, 0.5), 260);
  }

  // ------------------------------------------------------------ noises

  private noiseBurst(kind: 'white' | 'pink' | 'brown', filterType: BiquadFilterType, freq: number, q: number, attack: number, peak: number, decay: number, bus: BusName = 'sfx', reverb = 0.15) {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    const n = this.e.noiseSource(kind);
    const f = this.e.filter(filterType, freq, q);
    const g = this.e.gain(0);
    this.env(g, t0, attack, peak, decay);
    n.connect(f);
    f.connect(g);
    this.e.out(g, bus, reverb);
    n.stop(t0 + attack + decay + 0.1);
    return f;
  }

  crinkle(vel = 1) {
    // a few overlapping paper crackles
    const k = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < k; i++) {
      setTimeout(() => this.noiseBurst('white', 'highpass', 1800 + Math.random() * 1500, 0.8, 0.004, 0.16 * vel, 0.05 + Math.random() * 0.08), i * 40 + Math.random() * 30);
    }
  }

  snap() {
    this.noiseBurst('white', 'bandpass', 3200, 1.5, 0.001, 0.4, 0.035);
    this.noiseBurst('white', 'lowpass', 600, 1, 0.001, 0.25, 0.05);
  }

  leaf(vel = 1) {
    this.noiseBurst('pink', 'lowpass', 2400, 0.7, 0.02, 0.18 * vel, 0.22);
  }

  paperFold() {
    this.noiseBurst('white', 'highpass', 2600, 0.8, 0.01, 0.16, 0.14);
  }

  match() {
    this.noiseBurst('white', 'highpass', 2200, 0.7, 0.004, 0.3, 0.09);
    setTimeout(() => this.noiseBurst('pink', 'bandpass', 900, 0.6, 0.15, 0.18, 0.7, 'sfx', 0.2), 90);
  }

  flameOn() {
    this.noiseBurst('pink', 'lowpass', 1200, 0.5, 0.12, 0.2, 0.5, 'sfx', 0.2);
  }

  woodKnock(vel = 1) {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    const o = this.e.osc('sine', 220);
    o.frequency.exponentialRampToValueAtTime(120, t0 + 0.05);
    const g = this.e.gain(0);
    this.env(g, t0, 0.002, 0.35 * vel, 0.12);
    o.connect(g);
    this.e.out(g, 'sfx', 0.2);
    o.start(t0);
    o.stop(t0 + 0.2);
    this.noiseBurst('white', 'bandpass', 1400, 1, 0.001, 0.12 * vel, 0.03);
  }

  cowrie() {
    this.noiseBurst('white', 'bandpass', 4200 + Math.random() * 1500, 4, 0.001, 0.22, 0.05, 'sfx', 0.1);
  }

  stoneClick() {
    this.noiseBurst('white', 'bandpass', 2600 + Math.random() * 800, 3, 0.001, 0.25, 0.05, 'sfx', 0.1);
  }

  splash(size = 1) {
    this.noiseBurst('white', 'bandpass', 1800, 0.6, 0.01, 0.35 * size, 0.28 * size, 'sfx', 0.3);
    this.noiseBurst('pink', 'lowpass', 500, 0.7, 0.02, 0.25 * size, 0.35 * size, 'sfx', 0.3);
  }

  pour(seconds = 1.2) {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    const n = this.e.noiseSource('white');
    const f = this.e.filter('bandpass', 900, 0.9);
    f.frequency.setValueAtTime(700, t0);
    f.frequency.linearRampToValueAtTime(1600, t0 + seconds);
    const g = this.e.gain(0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.15);
    g.gain.setValueAtTime(0.32, t0 + seconds - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds + 0.1);
    n.connect(f);
    f.connect(g);
    this.e.out(g, 'sfx', 0.25);
    n.stop(t0 + seconds + 0.2);
  }

  footstep(surface: 'dirt' | 'wood' | 'water' | 'grass') {
    if (!this.e.ready) return;
    if (surface === 'wood') {
      this.woodKnock(0.25);
      return;
    }
    if (surface === 'water') {
      this.noiseBurst('pink', 'lowpass', 900, 0.8, 0.01, 0.08, 0.12, 'sfx', 0.1);
      return;
    }
    this.noiseBurst('brown', 'lowpass', surface === 'grass' ? 500 : 380, 0.8, 0.005, 0.16, 0.09, 'sfx', 0.05);
    this.noiseBurst('white', 'bandpass', 3000, 0.8, 0.002, 0.03, 0.04, 'sfx', 0);
  }

  thump(vel = 1) {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    const o = this.e.osc('sine', 95);
    o.frequency.exponentialRampToValueAtTime(48, t0 + 0.25);
    const g = this.e.gain(0);
    this.env(g, t0, 0.004, 0.6 * vel, 0.6);
    o.connect(g);
    this.e.out(g, 'music', 0.3);
    o.start(t0);
    o.stop(t0 + 0.8);
    this.noiseBurst('brown', 'lowpass', 300, 1, 0.002, 0.3 * vel, 0.08, 'music', 0.1);
  }

  shuttle() {
    this.noiseBurst('pink', 'bandpass', 1100, 1.2, 0.03, 0.14, 0.18, 'sfx', 0.2);
    setTimeout(() => this.woodKnock(0.5), 170);
  }

  clink() {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    for (const f of [3200, 4800]) {
      const o = this.e.osc('sine', f);
      const g = this.e.gain(0);
      this.env(g, t0, 0.001, 0.12, 0.35);
      o.connect(g);
      this.e.out(g, 'sfx', 0.3);
      o.start(t0);
      o.stop(t0 + 0.5);
    }
  }

  /** Egg crack + soy pour. */
  crackEgg() {
    this.noiseBurst('white', 'highpass', 3000, 1, 0.001, 0.3, 0.04);
    setTimeout(() => this.noiseBurst('white', 'bandpass', 1800, 1.5, 0.001, 0.2, 0.05), 90);
    setTimeout(() => this.pour(0.6), 600);
  }

  whistle(seconds = 1.6) {
    // putu bambu steam whistle, far away
    if (!this.e.ready) return;
    const t0 = this.e.now;
    const o = this.e.osc('sine', 1900);
    o.frequency.setValueAtTime(1750, t0);
    o.frequency.linearRampToValueAtTime(1950, t0 + 0.4);
    const n = this.e.noiseSource('white');
    const nf = this.e.filter('bandpass', 1900, 12);
    const g = this.e.gain(0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.045, t0 + 0.5);
    g.gain.setValueAtTime(0.045, t0 + seconds - 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    o.connect(g);
    n.connect(nf);
    nf.connect(g);
    this.e.out(g, 'ambience', 0.6);
    o.start(t0);
    o.stop(t0 + seconds + 0.1);
    n.stop(t0 + seconds + 0.1);
  }

  /** The roti man's horn passing on the street: two soft honks. */
  horn() {
    if (!this.e.ready) return;
    const t0 = this.e.now;
    for (const [dt, f] of [
      [0, 392],
      [0.45, 330],
    ] as [number, number][]) {
      const o = this.e.osc('sawtooth', f);
      const lp = this.e.filter('lowpass', 1200, 0.8);
      const g = this.e.gain(0);
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.06, t0 + dt + 0.06);
      g.gain.setValueAtTime(0.06, t0 + dt + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.45);
      o.connect(lp);
      lp.connect(g);
      this.e.out(g, 'ambience', 0.5);
      o.start(t0 + dt);
      o.stop(t0 + dt + 0.5);
    }
  }
}

/** A sustained voice that can be started and stopped (sompoton, tanpura, wau hum). */
export class Drone {
  private nodes: AudioScheduledSourceNode[] = [];
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  playing = false;

  constructor(private e: AudioEngine, private kind: 'sompoton' | 'tanpura' | 'hum', private bus: BusName = 'music') {}

  start(freqs: number[], level = 0.2) {
    if (!this.e.ready || this.playing) return;
    const ctx = this.e.ctx!;
    const t0 = ctx.currentTime;
    this.gainNode = this.e.gain(0);
    const attack = this.kind === 'hum' ? 0.6 : this.kind === 'sompoton' ? 0.35 : 1.2;
    this.gainNode.gain.setValueAtTime(0.0001, t0);
    this.gainNode.gain.exponentialRampToValueAtTime(level, t0 + attack);
    if (this.kind === 'sompoton') {
      this.filterNode = this.e.filter('bandpass', 950, 1.4);
      const lfo = this.e.osc('sine', 5.2);
      const lfoGain = this.e.gain(3.5);
      lfo.connect(lfoGain);
      for (const f of freqs) {
        for (const [type, det, g] of [
          ['triangle', 1, 0.5],
          ['square', 1.004, 0.18],
          ['sawtooth', 0.5, 0.12],
        ] as [OscillatorType, number, number][]) {
          const o = this.e.osc(type, f * det);
          lfoGain.connect(o.detune);
          const og = this.e.gain(g);
          o.connect(og);
          og.connect(this.filterNode);
          o.start(t0);
          this.nodes.push(o);
        }
      }
      lfo.start(t0);
      this.nodes.push(lfo);
      this.filterNode.connect(this.gainNode);
    } else if (this.kind === 'tanpura') {
      this.filterNode = this.e.filter('lowpass', 700, 0.9);
      const lfo = this.e.osc('sine', 0.13);
      const lfoGain = this.e.gain(250);
      lfo.connect(lfoGain);
      lfoGain.connect(this.filterNode.frequency);
      lfo.start(t0);
      this.nodes.push(lfo);
      for (const f of freqs) {
        for (const det of [0.999, 1.0015]) {
          const o = this.e.osc('sawtooth', f * det);
          const og = this.e.gain(0.2);
          o.connect(og);
          og.connect(this.filterNode);
          o.start(t0);
          this.nodes.push(o);
        }
      }
      this.filterNode.connect(this.gainNode);
    } else {
      // wau bulan bow hum: a reedy tone with a slow wobble
      this.filterNode = this.e.filter('bandpass', 420, 3);
      const lfo = this.e.osc('sine', 0.7);
      const lfoGain = this.e.gain(140);
      lfo.connect(lfoGain);
      lfoGain.connect(this.filterNode.frequency);
      lfo.start(t0);
      this.nodes.push(lfo);
      for (const f of freqs) {
        const o = this.e.osc('sawtooth', f);
        const o2 = this.e.osc('sine', f * 2.01);
        const og = this.e.gain(0.35);
        const og2 = this.e.gain(0.25);
        o.connect(og);
        o2.connect(og2);
        og.connect(this.filterNode);
        og2.connect(this.filterNode);
        o.start(t0);
        o2.start(t0);
        this.nodes.push(o, o2);
      }
      const n = this.e.noiseSource('pink');
      const nf = this.e.filter('bandpass', 600, 2);
      const ng = this.e.gain(0.12);
      n.connect(nf);
      nf.connect(ng);
      ng.connect(this.filterNode);
      this.nodes.push(n);
      this.filterNode.connect(this.gainNode);
    }
    this.e.out(this.gainNode, this.bus, this.kind === 'hum' ? 0.15 : 0.45);
    this.playing = true;
  }

  setLevel(level: number, time = 0.15) {
    if (this.gainNode) this.gainNode.gain.setTargetAtTime(Math.max(0.0001, level), this.e.now, time);
  }

  setFilter(freq: number) {
    if (this.filterNode) this.filterNode.frequency.setTargetAtTime(freq, this.e.now, 0.2);
  }

  stop(release = 0.8) {
    if (!this.playing || !this.gainNode) return;
    const t0 = this.e.now;
    this.gainNode.gain.cancelScheduledValues(t0);
    this.gainNode.gain.setTargetAtTime(0.0001, t0, release / 4);
    const nodes = this.nodes;
    for (const n of nodes) {
      try {
        n.stop(t0 + release + 0.2);
      } catch {
        /* ignore */
      }
    }
    this.nodes = [];
    this.gainNode = null;
    this.filterNode = null;
    this.playing = false;
  }
}
