export type BusName = 'ambience' | 'weather' | 'music' | 'sfx';

/**
 * Web Audio graph. Everything in the garden is synthesised; there are no audio files.
 * master <- compressor <- { ambience, weather, music, sfx } ; a shared convolver reverb hangs off a send bus.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  buses!: Record<BusName, GainNode>;
  reverb!: ConvolverNode;
  reverbIn!: GainNode;
  private noiseBuffers = new Map<string, AudioBuffer>();
  private volume = 0.8;
  private unlocked = false;
  private onReady: (() => void)[] = [];

  get ready() {
    return this.unlocked && this.ctx !== null;
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  whenReady(fn: () => void) {
    if (this.ready) fn();
    else this.onReady.push(fn);
  }

  async unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.build();
    }
    try {
      await this.ctx.resume();
    } catch {
      /* resume may fail without a gesture; the next tap retries */
    }
    if (this.ctx.state === 'running' && !this.unlocked) {
      this.unlocked = true;
      for (const fn of this.onReady) fn();
      this.onReady = [];
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  private build() {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.01;
    comp.release.value = 0.35;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    const mk = (g: number) => {
      const n = ctx.createGain();
      n.gain.value = g;
      n.connect(this.master);
      return n;
    };
    this.buses = { ambience: mk(0.9), weather: mk(0.9), music: mk(0.8), sfx: mk(0.9) };

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.6, 2.4);
    this.reverbIn = ctx.createGain();
    this.reverbIn.gain.value = 1;
    this.reverbIn.connect(this.reverb);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverb.connect(wet);
    wet.connect(this.master);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.now, 0.05);
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1);
      }
    }
    return buf;
  }

  noiseBuffer(kind: 'white' | 'pink' | 'brown') {
    let b = this.noiseBuffers.get(kind);
    if (b) return b;
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const len = rate * 4;
    b = ctx.createBuffer(1, len, rate);
    const d = b.getChannelData(0);
    if (kind === 'white') {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else if (kind === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    // seamless loop: crossfade the tail into the head
    const fade = Math.floor(rate * 0.05);
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      d[len - fade + i] = d[len - fade + i] * (1 - t) + d[i] * t;
    }
    this.noiseBuffers.set(kind, b);
    return b;
  }

  noiseSource(kind: 'white' | 'pink' | 'brown') {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuffer(kind);
    src.loop = true;
    src.start();
    return src;
  }

  gain(v = 0) {
    const g = this.ctx!.createGain();
    g.gain.value = v;
    return g;
  }

  filter(type: BiquadFilterType, freq: number, q = 1) {
    const f = this.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  osc(type: OscillatorType, freq: number) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }

  /** Connect a node to a bus with an optional reverb send. */
  out(node: AudioNode, bus: BusName, reverb = 0) {
    node.connect(this.buses[bus]);
    if (reverb > 0) {
      const send = this.gain(reverb);
      node.connect(send);
      send.connect(this.reverbIn);
    }
  }
}
