import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { degToRad, rng, lerp } from '../core/util';
import { LAKE_RADIUS } from '../content/stations';
import { Terrain, WATER_Y } from './Terrain';
import type { Path } from './Path';

export interface WindUniforms {
  uTime: { value: number };
  uWind: { value: number };
}

/** Injects a gentle wind sway into any MeshStandardMaterial (works with InstancedMesh). */
export function applyWind(material: THREE.Material, uniforms: WindUniforms, height: number, amp: number) {
  const mat = material as THREE.MeshStandardMaterial;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;
    shader.uniforms.uHeight = { value: height };
    shader.uniforms.uAmp = { value: amp };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
uniform float uWind;
uniform float uHeight;
uniform float uAmp;`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
{
  #ifdef USE_INSTANCING
    vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  #else
    vec3 iPos = vec3(0.0);
  #endif
  float ph = iPos.x * 0.37 + iPos.z * 0.29;
  float hgt = clamp(position.y / max(uHeight, 0.001), 0.0, 1.0);
  float f = hgt * hgt * uAmp * (0.4 + uWind);
  transformed.x += (sin(uTime * 1.25 + ph) * 0.55 + sin(uTime * 2.3 + ph * 1.7) * 0.25) * f;
  transformed.z += (cos(uTime * 1.05 + ph * 0.8) * 0.4) * f;
}`,
      );
  };
  mat.customProgramCacheKey = () => `wind`;
  return mat;
}

function colored(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function rainforestTree(seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const h = 5.5 + r() * 3;
  const trunk = new THREE.CylinderGeometry(0.22, 0.42, h, 6);
  trunk.translate(0, h / 2, 0);
  parts.push(colored(trunk, '#5a3e2a'));
  const greens = ['#3f7a35', '#4a8a3c', '#356b2e', '#5a9a44'];
  const n = 3 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const rad = 1.6 + r() * 1.4;
    const g = new THREE.IcosahedronGeometry(rad, 0);
    g.translate((r() - 0.5) * 2.2, h - 0.6 + (r() - 0.3) * 1.8, (r() - 0.5) * 2.2);
    parts.push(colored(g, greens[Math.floor(r() * greens.length)]));
  }
  const merged = mergeGeometries(parts, false)!;
  merged.computeVertexNormals();
  return { geo: merged, height: h + 2 };
}

function palmTree(seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const h = 6 + r() * 3;
  const trunk = new THREE.CylinderGeometry(0.13, 0.22, h, 6);
  trunk.translate(0, h / 2, 0);
  parts.push(colored(trunk, '#8a7358'));
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.3;
    const frond = new THREE.PlaneGeometry(0.55, 2.8, 1, 3);
    // droop: bend the tip downwards
    const p = frond.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k);
      const t = (y + 1.4) / 2.8;
      p.setZ(k, -t * t * 1.1);
      p.setX(k, p.getX(k) * (1 - t * 0.6));
    }
    frond.translate(0, 1.4, 0);
    frond.rotateX(-Math.PI / 2 + 0.9);
    frond.rotateY(a);
    frond.translate(0, h, 0);
    parts.push(colored(frond, i % 2 ? '#4f8f3a' : '#3f7a30'));
  }
  const nut = new THREE.SphereGeometry(0.16, 6, 4);
  nut.translate(0.15, h - 0.2, 0.1);
  parts.push(colored(nut, '#6a8a3a'));
  const merged = mergeGeometries(parts, false)!;
  merged.computeVertexNormals();
  return { geo: merged, height: h + 1 };
}

function berembangTree(seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const h = 4 + r() * 2;
  const trunk = new THREE.CylinderGeometry(0.2, 0.3, h, 6);
  trunk.translate(0, h / 2, 0);
  parts.push(colored(trunk, '#4a3a2a'));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const root = new THREE.CylinderGeometry(0.05, 0.07, 1.6, 4);
    root.rotateZ(0.6);
    root.rotateY(a);
    root.translate(Math.sin(a) * 0.5, 0.5, Math.cos(a) * 0.5);
    parts.push(colored(root, '#3a2e22'));
  }
  const canopy = new THREE.IcosahedronGeometry(2.6, 1);
  canopy.scale(1.3, 0.6, 1.3);
  canopy.translate(0, h + 0.4, 0);
  parts.push(colored(canopy, '#2f5f33'));
  const merged = mergeGeometries(parts, false)!;
  merged.computeVertexNormals();
  return { geo: merged, height: h + 1.5 };
}

function tuft(height: number, width: number, colorA: string, colorB: string, blades = 2) {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < blades; i++) {
    const p = new THREE.PlaneGeometry(width, height, 1, 2);
    const pos = p.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) {
      const t = (pos.getY(k) + height / 2) / height;
      pos.setX(k, pos.getX(k) * (1 - t * 0.85));
    }
    p.translate(0, height / 2, 0);
    p.rotateY((i / blades) * Math.PI);
    const c = new THREE.Color(colorA).lerp(new THREE.Color(colorB), i / blades);
    parts.push(colored(p, c));
  }
  const merged = mergeGeometries(parts, false)!;
  return merged;
}

export interface VegetationOptions {
  trees: number;
  palms: number;
  grass: number;
  padi: number;
  shadows: boolean;
}

export class Vegetation {
  group = new THREE.Group();
  uniforms: WindUniforms = { uTime: { value: 0 }, uWind: { value: 0.5 } };
  private windTarget = 0.5;
  private gust = 0;

  constructor(terrain: Terrain, path: Path, opts: VegetationOptions) {
    const r = rng(2024);
    const angleOf = Terrain.angleOf;
    const dAng = Terrain.angleDelta;

    const clear = (x: number, z: number) => {
      if (path.distanceTo(x, z) < 3.4) return false;
      for (const p of terrain.pads) if (Math.hypot(x - p.x, z - p.z) < 12.5) return false;
      return true;
    };

    const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
    const bladeMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.95, side: THREE.DoubleSide });

    // ---- rainforest trees
    const treeVariants = [rainforestTree(1), rainforestTree(2), rainforestTree(3)];
    const treePlacements: THREE.Matrix4[][] = [[], [], []];
    let attempts = 0;
    while (treePlacements.flat().length < opts.trees && attempts < opts.trees * 40) {
      attempts++;
      const a = r() * 360;
      const rad = LAKE_RADIUS + 5 + r() * 65;
      const x = Math.sin(degToRad(a)) * rad;
      const z = Math.cos(degToRad(a)) * rad;
      const inner = rad < 72;
      // wedges without trees
      if (inner) {
        if (dAng(a, 45) < 18) continue; // padang
        if (dAng(a, 180) < 22) continue; // sawah
        if (dAng(a, 270) < 14) continue; // town street
        if (!clear(x, z)) continue;
        // density: dense in hutan and wakaf wedges, sparse elsewhere
        const hutan = dAng(a, 90) < 30 || dAng(a, 135) < 16;
        if (!hutan && r() < 0.75) continue;
      } else if (r() < 0.35) continue;
      const y = terrain.height(x, z) - 0.15;
      const s = (inner ? 0.85 : 1.2) + r() * 0.5;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2), new THREE.Vector3(s, s * (0.9 + r() * 0.3), s));
      treePlacements[Math.floor(r() * 3)].push(m);
    }
    treeVariants.forEach((v, i) => this.addInstanced(v.geo, treeMat, treePlacements[i], v.height, 0.35, opts.shadows));

    // ---- coconut palms near the kampung and the longhouse shore
    const palmVariants = [palmTree(4), palmTree(5)];
    const palmPlacements: THREE.Matrix4[][] = [[], []];
    attempts = 0;
    while (palmPlacements.flat().length < opts.palms && attempts < opts.palms * 60) {
      attempts++;
      const a = r() < 0.6 ? (r() - 0.5) * 60 : 225 + (r() - 0.5) * 50;
      const rad = LAKE_RADIUS + 5 + r() * 24;
      const x = Math.sin(degToRad(a)) * rad;
      const z = Math.cos(degToRad(a)) * rad;
      if (!clear(x, z)) continue;
      const y = terrain.height(x, z) - 0.1;
      const s = 0.8 + r() * 0.4;
      const lean = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.16, r() * Math.PI * 2, (r() - 0.5) * 0.16));
      palmPlacements[Math.floor(r() * 2)].push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), lean, new THREE.Vector3(s, s, s)));
    }
    palmVariants.forEach((v, i) => this.addInstanced(v.geo, palmMatFor(treeMat), palmPlacements[i], v.height, 0.5, opts.shadows));

    // ---- berembang along the south-west shore (firefly trees)
    const ber = berembangTree(6);
    const berPlacements: THREE.Matrix4[] = [];
    for (let i = 0; i < 30; i++) {
      const a = 282 + (i / 30) * 66 + (r() - 0.5) * 2;
      const rad = LAKE_RADIUS + 0.2 + r() * 2.2;
      const x = Math.sin(degToRad(a)) * rad;
      const z = Math.cos(degToRad(a)) * rad;
      if (path.distanceTo(x, z) < 3) continue;
      const y = Math.max(terrain.height(x, z), WATER_Y - 0.6);
      const s = 0.9 + r() * 0.4;
      berPlacements.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28), new THREE.Vector3(s, s, s)));
    }
    this.berembang = berPlacements.map((m) => new THREE.Vector3().setFromMatrixPosition(m));
    this.addInstanced(ber.geo, treeMat, berPlacements, ber.height, 0.25, opts.shadows);

    // ---- grass tufts
    const grassGeo = tuft(0.55, 0.32, '#6f9a48', '#9ab55a', 2);
    const grassPlacements: THREE.Matrix4[] = [];
    attempts = 0;
    while (grassPlacements.length < opts.grass && attempts < opts.grass * 6) {
      attempts++;
      const a = r() * 360;
      const rad = LAKE_RADIUS + 4.5 + r() * 26;
      const x = Math.sin(degToRad(a)) * rad;
      const z = Math.cos(degToRad(a)) * rad;
      if (dAng(a, 180) < 22 && rad < 72) continue;
      if (dAng(a, 270) < 13 && rad < 64) continue;
      if (path.distanceTo(x, z) < 1.6) continue;
      const y = terrain.height(x, z) - 0.02;
      const s = 0.7 + r() * 0.7;
      grassPlacements.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28), new THREE.Vector3(s, s, s)));
    }
    this.addInstanced(grassGeo, bladeMat, grassPlacements, 0.55, 0.12, false);

    // ---- padi in rows around the sawah
    const padiGeo = tuft(0.95, 0.22, '#9ab23c', '#d8c95a', 3);
    const padiPlacements: THREE.Matrix4[] = [];
    const rows = Math.max(10, Math.floor(Math.sqrt(opts.padi) * 1.2));
    const perRow = Math.max(10, Math.floor(opts.padi / rows));
    for (let i = 0; i < rows; i++) {
      const a = 180 + lerp(-20, 20, i / (rows - 1));
      for (let j = 0; j < perRow; j++) {
        const rad = lerp(LAKE_RADIUS + 6.5, 71, j / (perRow - 1)) + (r() - 0.5) * 0.25;
        const aa = a + (r() - 0.5) * 0.15;
        const x = Math.sin(degToRad(aa)) * rad;
        const z = Math.cos(degToRad(aa)) * rad;
        if (path.distanceTo(x, z) < 2.2) continue;
        const pad = terrain.padFor('sawah');
        const dp = Math.hypot(x - pad.x, z - pad.z);
        if (dp < 6.5) continue;
        const y = terrain.height(x, z) - 0.05;
        const s = 0.85 + r() * 0.3;
        padiPlacements.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28), new THREE.Vector3(s, s, s)));
      }
    }
    this.addInstanced(padiGeo, bladeMat.clone(), padiPlacements, 0.95, 0.22, false);

    function palmMatFor(base: THREE.MeshStandardMaterial) {
      const m = base.clone();
      m.side = THREE.DoubleSide;
      return m;
    }
  }

  /** World positions of the berembang trees (for fireflies). */
  berembang: THREE.Vector3[] = [];

  private addInstanced(geo: THREE.BufferGeometry, material: THREE.MeshStandardMaterial, mats: THREE.Matrix4[], height: number, amp: number, shadows: boolean) {
    if (mats.length === 0) return;
    const m = material.clone();
    applyWind(m, this.uniforms, height, amp);
    const inst = new THREE.InstancedMesh(geo, m, mats.length);
    for (let i = 0; i < mats.length; i++) inst.setMatrixAt(i, mats[i]);
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = shadows;
    inst.receiveShadow = shadows;
    inst.frustumCulled = false;
    this.group.add(inst);
  }

  /** A short gust (e.g. when the big gong is struck). */
  pulse(strength = 1) {
    this.gust = Math.max(this.gust, strength);
  }

  setWind(w: number) {
    this.windTarget = w;
  }

  update(dt: number, time: number) {
    this.uniforms.uTime.value = time;
    this.gust = Math.max(0, this.gust - dt * 0.6);
    const w = this.windTarget + this.gust * 1.5;
    this.uniforms.uWind.value += (w - this.uniforms.uWind.value) * Math.min(1, dt * 2);
  }
}
