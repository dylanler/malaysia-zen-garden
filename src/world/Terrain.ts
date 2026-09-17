import * as THREE from 'three';
import { fbm, lerp, smoothstep, clamp, degToRad } from '../core/util';
import { LAKE_RADIUS, STATIONS, type StationId } from '../content/stations';
import type { Path } from './Path';

export const WATER_Y = -0.35;

interface Pad {
  id: StationId;
  x: number;
  z: number;
  r: number;
  h: number;
  angle: number;
}

export class Terrain {
  pads: Pad[] = [];
  mesh!: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  private baseColor = new THREE.Color();

  constructor() {
    for (const s of STATIONS) {
      if (s.id === 'tasik') continue;
      const a = degToRad(s.angle);
      const x = Math.sin(a) * s.radius;
      const z = Math.cos(a) * s.radius;
      this.pads.push({ id: s.id, x, z, r: 11, h: 0, angle: s.angle });
    }
    for (const p of this.pads) p.h = this.rawHeight(p.x, p.z);
    // the waterfall pool is carved out of the Air Terjun pad
    const at = this.padFor('airterjun');
    const a = degToRad(90);
    const bx = at.x + Math.cos(a) * 1.2 + Math.sin(a) * 5.2;
    const bz = at.z - Math.sin(a) * 1.2 + Math.cos(a) * 5.2;
    this.basins.push({ x: bx, z: bz, r: 3.4, depth: 1.1 });
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.95,
      metalness: 0,
    });
    this.baseColor.copy(this.material.color);
  }

  private rawHeight(x: number, z: number) {
    const r = Math.hypot(x, z);
    let h: number;
    if (r < LAKE_RADIUS) {
      h = lerp(-0.6, -3.2, smoothstep(LAKE_RADIUS, LAKE_RADIUS - 10, r));
    } else if (r < LAKE_RADIUS + 4) {
      h = lerp(-0.6, 0.15, smoothstep(LAKE_RADIUS, LAKE_RADIUS + 4, r));
    } else {
      const n = fbm(x * 0.045 + 10, z * 0.045 + 10, 3);
      h = 0.15 + (n - 0.5) * 1.2 * smoothstep(LAKE_RADIUS + 4, LAKE_RADIUS + 9, r);
      if (r > 68) {
        // a ring of low hills that levels off, so the far edge never towers over the sky;
        // they open out to the north so Kinabalu shows above the padi
        const t = Math.min((r - 68) / 30, 1.25);
        const north = Terrain.angleDelta(Terrain.angleOf(x, z), 180);
        const scale = lerp(0.22, 1, smoothstep(18, 60, north));
        h += (t * t * 16 + (fbm(x * 0.03, z * 0.03, 3) - 0.5) * 6 * smoothstep(68, 85, r)) * scale;
      }
    }
    return h;
  }

  basins: { x: number; z: number; r: number; depth: number }[] = [];

  height(x: number, z: number) {
    let h = this.rawHeight(x, z);
    for (const p of this.pads) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r) {
        const t = smoothstep(p.r, p.r * 0.5, d);
        h = lerp(h, p.h, t);
      }
    }
    for (const b of this.basins) {
      const d = Math.hypot(x - b.x, z - b.z);
      if (d < b.r) h -= b.depth * smoothstep(b.r, b.r * 0.35, d);
    }
    return h;
  }

  padFor(id: StationId) {
    return this.pads.find((p) => p.id === id)!;
  }

  /** Angle (degrees, 0..360) of a world position around the lake. */
  static angleOf(x: number, z: number) {
    let a = (Math.atan2(x, z) * 180) / Math.PI;
    if (a < 0) a += 360;
    return a;
  }

  static angleDelta(a: number, b: number) {
    let d = Math.abs(a - b) % 360;
    if (d > 180) d = 360 - d;
    return d;
  }

  buildMesh(path: Path, segments: number) {
    const size = 260;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const sand = new THREE.Color('#d9c8a0');
    const bed = new THREE.Color('#3d4f3f');
    const grassA = new THREE.Color('#6f9a48');
    const grassB = new THREE.Color('#8fae55');
    const forest = new THREE.Color('#446a38');
    const padi = new THREE.Color('#8a9a3c');
    const mud = new THREE.Color('#6a6e3a');
    const street = new THREE.Color('#6d6b70');
    const dirt = new THREE.Color('#a68d63');
    const hill = new THREE.Color('#4f6f45');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = this.height(x, z);
      pos.setY(i, h);
      const r = Math.hypot(x, z);
      const ang = Terrain.angleOf(x, z);
      const n = fbm(x * 0.08, z * 0.08, 2);
      if (r < LAKE_RADIUS + 1.2) {
        c.copy(bed).lerp(sand, smoothstep(LAKE_RADIUS - 6, LAKE_RADIUS + 1.2, r));
      } else if (r < LAKE_RADIUS + 4.5) {
        c.copy(sand).lerp(grassA, smoothstep(LAKE_RADIUS + 2.5, LAKE_RADIUS + 4.5, r));
      } else {
        c.copy(grassA).lerp(grassB, n);
        // forest floor around the waterfall
        const dHutan = Terrain.angleDelta(ang, 90);
        c.lerp(forest, smoothstep(30, 14, dHutan) * smoothstep(44, 50, r));
        // padi around the sawah
        const dSawah = Terrain.angleDelta(ang, 180);
        const padiT = smoothstep(26, 16, dSawah) * smoothstep(45, 49, r) * smoothstep(74, 68, r);
        c.lerp(padi, padiT * 0.55).lerp(mud, padiT * 0.35);
        // street pad
        const dJalan = Terrain.angleDelta(ang, 270);
        c.lerp(street, smoothstep(13, 7, dJalan) * smoothstep(47, 50, r) * smoothstep(64, 61, r));
        // hills fade darker
        c.lerp(hill, smoothstep(70, 95, r));
      }
      // path
      const dPath = path.distanceTo(x, z);
      if (r > LAKE_RADIUS + 1) c.lerp(dirt, smoothstep(2.4, 1.1, dPath) * 0.85);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'terrain';
    return this.mesh;
  }

  /** 0 = dry, 1 = soaked. Darkens and glosses the ground. */
  setWetness(w: number) {
    w = clamp(w, 0, 1);
    this.material.roughness = lerp(0.95, 0.45, w);
    this.material.color.copy(this.baseColor).multiplyScalar(lerp(1, 0.72, w));
  }
}
