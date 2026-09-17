import * as THREE from 'three';
import { degToRad, hash2 } from '../core/util';
import { LAKE_RADIUS, STATIONS, type StationId } from '../content/stations';
import { Terrain, WATER_Y } from './Terrain';

export const JETTY_DECK_Y = 0.42;

interface Waypoint {
  angle: number;
  radius: number;
  kind: 'land' | 'jetty' | 'water';
}

export class Path {
  curve: THREE.CatmullRomCurve3;
  length: number;
  stationU: Record<StationId, number> = {} as Record<StationId, number>;
  /** u values at which auto-walk stops, in increasing order. */
  stops: { id: StationId; u: number }[] = [];
  waterRange: [number, number] = [0, 0];
  jettyRanges: [number, number][] = [];
  private samples: THREE.Vector3[] = [];
  private sampleU: number[] = [];
  private grid = new Map<string, number[]>();
  private cell = 4;

  constructor(private terrain: Terrain) {
    const wps: Waypoint[] = [];
    const land = STATIONS.filter((s) => s.id !== 'tasik').sort((a, b) => a.order - b.order);
    land.forEach((s, i) => {
      wps.push({ angle: s.angle, radius: s.radius, kind: 'land' });
      if (i < land.length - 1) {
        const mid = s.angle + 22.5;
        const wobble = (hash2(i, 3) - 0.5) * 5;
        wps.push({ angle: mid, radius: s.radius + wobble, kind: 'land' });
      }
    });
    // from Jalan Kenangan (270) down the jetty and across the lake
    wps.push({ angle: 274.5, radius: 46.5, kind: 'land' });
    wps.push({ angle: 276.5, radius: 42.5, kind: 'jetty' });
    wps.push({ angle: 278, radius: 39, kind: 'jetty' });
    wps.push({ angle: 286, radius: 34, kind: 'water' });
    wps.push({ angle: 300, radius: 29.5, kind: 'water' });
    wps.push({ angle: 315, radius: 28, kind: 'water' });
    wps.push({ angle: 330, radius: 29.5, kind: 'water' });
    wps.push({ angle: 344, radius: 34, kind: 'water' });
    wps.push({ angle: 352.5, radius: 39, kind: 'jetty' });
    wps.push({ angle: 354, radius: 42.5, kind: 'jetty' });
    wps.push({ angle: 355.5, radius: 46.5, kind: 'land' });
    wps.push({ angle: 357.5, radius: 51, kind: 'land' });

    const pts = wps.map((w) => {
      const a = degToRad(w.angle);
      const x = Math.sin(a) * w.radius;
      const z = Math.cos(a) * w.radius;
      let y: number;
      if (w.kind === 'water') y = WATER_Y;
      else if (w.kind === 'jetty') y = JETTY_DECK_Y;
      else y = terrain.height(x, z);
      return new THREE.Vector3(x, y, z);
    });
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    this.curve.arcLengthDivisions = 800;
    this.length = this.curve.getLength();

    // dense samples for nearest lookups and terrain painting
    const N = 1600;
    for (let i = 0; i < N; i++) {
      const u = i / N;
      const p = this.curve.getPointAt(u);
      this.samples.push(p);
      this.sampleU.push(u);
      const key = this.key(p.x, p.z);
      let arr = this.grid.get(key);
      if (!arr) {
        arr = [];
        this.grid.set(key, arr);
      }
      arr.push(i);
    }

    // station u values: nearest sample to each station centre
    for (const s of STATIONS) {
      const a = degToRad(s.angle);
      const cx = Math.sin(a) * s.radius;
      const cz = Math.cos(a) * s.radius;
      this.stationU[s.id] = this.nearestU(cx, cz);
    }
    this.stops = STATIONS.map((s) => ({ id: s.id, u: this.stationU[s.id] })).sort((a, b) => a.u - b.u);

    // water range
    let wStart = -1;
    let wEnd = -1;
    for (let i = 0; i < N; i++) {
      const p = this.samples[i];
      const onWater = Math.hypot(p.x, p.z) < LAKE_RADIUS - 0.5;
      if (onWater && wStart < 0) wStart = this.sampleU[i];
      if (onWater) wEnd = this.sampleU[i];
    }
    this.waterRange = [wStart, wEnd];
  }

  private key(x: number, z: number) {
    return `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`;
  }

  getPoint(u: number, out: THREE.Vector3) {
    return this.curve.getPointAt(((u % 1) + 1) % 1, out);
  }

  getTangent(u: number, out: THREE.Vector3) {
    return this.curve.getTangentAt(((u % 1) + 1) % 1, out);
  }

  isWater(u: number) {
    return u >= this.waterRange[0] && u <= this.waterRange[1];
  }

  /** Surface mode at u: 'land' | 'jetty' | 'water'. */
  surfaceAt(u: number): 'land' | 'jetty' | 'water' {
    const p = this.getPoint(u, this.tmp);
    return Path.surfaceForPoint(p.x, p.z);
  }

  /** The land path never comes closer than ~47 m to the centre, so radius alone decides. */
  static surfaceForPoint(x: number, z: number): 'land' | 'jetty' | 'water' {
    const r = Math.hypot(x, z);
    if (r < LAKE_RADIUS - 0.6) return 'water';
    if (r < LAKE_RADIUS + 3.6) return 'jetty';
    return 'land';
  }

  private tmp = new THREE.Vector3();

  nearestU(x: number, z: number) {
    let best = Infinity;
    let bestU = 0;
    for (let i = 0; i < this.samples.length; i++) {
      const p = this.samples[i];
      const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d < best) {
        best = d;
        bestU = this.sampleU[i];
      }
    }
    return bestU;
  }

  distanceTo(x: number, z: number) {
    const cx = Math.floor(x / this.cell);
    const cz = Math.floor(z / this.cell);
    let best = Infinity;
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const arr = this.grid.get(`${cx + dx},${cz + dz}`);
        if (!arr) continue;
        for (const i of arr) {
          const p = this.samples[i];
          const d = Math.hypot(p.x - x, p.z - z);
          if (d < best) best = d;
        }
      }
    if (best === Infinity) return 99;
    return best;
  }

  /** Next stop strictly after u (wrapping). */
  nextStop(u: number) {
    for (const s of this.stops) if (s.u > u + 0.004) return s;
    return this.stops[0];
  }

  prevStop(u: number) {
    for (let i = this.stops.length - 1; i >= 0; i--) if (this.stops[i].u < u - 0.004) return this.stops[i];
    return this.stops[this.stops.length - 1];
  }
}
