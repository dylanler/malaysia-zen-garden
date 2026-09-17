export const TAU = Math.PI * 2;

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inverseLerp = (a: number, b: number, v: number) => (b === a ? 0 : clamp((v - a) / (b - a), 0, 1));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = inverseLerp(a, b, v);
  return t * t * (3 - 2 * t);
};
export const remap = (v: number, a: number, b: number, c: number, d: number) => lerp(c, d, inverseLerp(a, b, v));

/** Frame-rate independent exponential approach. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export const degToRad = (d: number) => (d * Math.PI) / 180;

/** Deterministic pseudo random generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x: number, y: number) {
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  h = h - Math.floor(h);
  return h;
}

/** Smooth value noise in [0,1]. */
export function valueNoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export function fbm(x: number, y: number, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

export const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export const isMobileUA = () =>
  typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

export function once<T extends (...args: never[]) => void>(fn: T): T {
  let done = false;
  return ((...args: never[]) => {
    if (done) return;
    done = true;
    fn(...args);
  }) as T;
}
