import * as THREE from 'three';
import { softCircleTexture } from './textures';
import { rng } from '../core/util';

// ---------------------------------------------------------------- rain

const rainVert = /* glsl */ `
uniform float uTime;
uniform vec3 uCenter;
uniform float uHeight;
uniform float uIntensity;
attribute float aSeed;
attribute float aEnd;
varying float vAlpha;
void main() {
  float speed = 9.0 + aSeed * 4.0;
  float y = mod(position.y - uTime * speed + aSeed * 100.0, uHeight);
  vec3 p = vec3(position.x, y, position.z) + uCenter;
  p.y -= uHeight * 0.35;
  p.y -= aEnd * 0.45; // streak length
  p.x += aEnd * 0.06;
  vAlpha = uIntensity * (0.35 + 0.4 * aSeed);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const rainFrag = /* glsl */ `
varying float vAlpha;
void main() {
  gl_FragColor = vec4(0.85, 0.9, 1.0, vAlpha);
}
`;

export class Rain {
  mesh: THREE.LineSegments;
  private uniforms: { uTime: { value: number }; uCenter: { value: THREE.Vector3 }; uHeight: { value: number }; uIntensity: { value: number } };
  intensity = 0;

  constructor(count: number) {
    const r = rng(77);
    const pos = new Float32Array(count * 2 * 3);
    const seed = new Float32Array(count * 2);
    const end = new Float32Array(count * 2);
    const W = 26;
    const H = 18;
    for (let i = 0; i < count; i++) {
      const x = (r() - 0.5) * W;
      const y = r() * H;
      const z = (r() - 0.5) * W;
      const s = r();
      for (let k = 0; k < 2; k++) {
        pos[(i * 2 + k) * 3] = x;
        pos[(i * 2 + k) * 3 + 1] = y;
        pos[(i * 2 + k) * 3 + 2] = z;
        seed[i * 2 + k] = s;
        end[i * 2 + k] = k;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.uniforms = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uHeight: { value: H }, uIntensity: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      vertexShader: rainVert,
      fragmentShader: rainFrag,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.LineSegments(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 20;
  }

  update(time: number, cameraPos: THREE.Vector3) {
    this.uniforms.uTime.value = time;
    this.uniforms.uCenter.value.copy(cameraPos);
    this.uniforms.uIntensity.value = this.intensity;
    this.mesh.visible = this.intensity > 0.01;
  }
}

// ---------------------------------------------------------------- soft sprite particles (mist, steam, smoke)

export interface EmitterOptions {
  count: number;
  color: THREE.ColorRepresentation;
  size: number;
  life: [number, number];
  velocity: () => THREE.Vector3;
  spawn: () => THREE.Vector3;
  gravity?: number;
  drag?: number;
  opacity?: number;
  blending?: THREE.Blending;
  growth?: number;
}

export class Emitter {
  points: THREE.Points;
  rate = 0; // particles per second (0 = off)
  private pos: Float32Array;
  private vel: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private alive: Uint8Array;
  private acc = 0;
  private sizes: Float32Array;
  private geo: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;

  constructor(private opts: EmitterOptions) {
    const n = opts.count;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.age = new Float32Array(n);
    this.life = new Float32Array(n);
    this.alive = new Uint8Array(n);
    this.sizes = new Float32Array(n);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.material = new THREE.PointsMaterial({
      map: softCircleTexture(),
      color: opts.color,
      size: opts.size,
      transparent: true,
      opacity: opts.opacity ?? 0.35,
      depthWrite: false,
      blending: opts.blending ?? THREE.NormalBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 15;
    for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -9999;
  }

  burst(count: number) {
    for (let i = 0; i < count; i++) this.spawnOne();
  }

  private spawnOne() {
    const n = this.opts.count;
    for (let i = 0; i < n; i++) {
      if (this.alive[i]) continue;
      const p = this.opts.spawn();
      const v = this.opts.velocity();
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z;
      this.vel[i * 3] = v.x;
      this.vel[i * 3 + 1] = v.y;
      this.vel[i * 3 + 2] = v.z;
      this.age[i] = 0;
      this.life[i] = this.opts.life[0] + Math.random() * (this.opts.life[1] - this.opts.life[0]);
      this.alive[i] = 1;
      return;
    }
  }

  update(dt: number) {
    if (this.rate > 0) {
      this.acc += dt * this.rate;
      while (this.acc >= 1) {
        this.acc -= 1;
        this.spawnOne();
      }
    }
    const g = this.opts.gravity ?? 0;
    const drag = this.opts.drag ?? 0;
    let any = false;
    for (let i = 0; i < this.opts.count; i++) {
      if (!this.alive[i]) continue;
      any = true;
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.alive[i] = 0;
        this.pos[i * 3 + 1] = -9999;
        continue;
      }
      this.vel[i * 3 + 1] += g * dt;
      const k = 1 - drag * dt;
      this.vel[i * 3] *= k;
      this.vel[i * 3 + 1] *= k;
      this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.points.visible = any;
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  setOpacity(o: number) {
    this.material.opacity = o;
  }
}

// ---------------------------------------------------------------- fireflies

const ffVert = /* glsl */ `
uniform float uTime;
uniform float uNight;
uniform vec3 uHand;
uniform float uCup;
uniform float uPixelRatio;
attribute float aGroup;
attribute float aSeed;
attribute vec3 aHome;
varying float vGlow;
void main() {
  // each tree pulses in near-unison; individuals wander slowly
  float phase = aGroup * 1.7;
  float pulse = sin(uTime * 2.4 + phase + aSeed * 0.35);
  pulse = smoothstep(0.55, 0.95, pulse);
  vec3 p = aHome;
  p.x += sin(uTime * 0.6 + aSeed * 12.0) * 0.6;
  p.y += sin(uTime * 0.9 + aSeed * 7.0) * 0.4;
  p.z += cos(uTime * 0.5 + aSeed * 9.0) * 0.6;
  // cupped hands draw the nearest few in
  float d = distance(aHome, uHand);
  float pull = uCup * smoothstep(9.0, 2.0, d) * step(0.72, aSeed);
  p = mix(p, uHand + vec3(sin(aSeed * 40.0) * 0.12, 0.05 + sin(aSeed * 33.0) * 0.06, cos(aSeed * 41.0) * 0.12), pull);
  vGlow = mix(pulse, 1.0, pull) * uNight;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (18.0 + 10.0 * pull) * uPixelRatio / max(1.0, -mv.z * 0.35);
  gl_Position = projectionMatrix * mv;
}
`;
const ffFrag = /* glsl */ `
uniform sampler2D uMap;
varying float vGlow;
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  vec3 col = vec3(0.72, 1.0, 0.45);
  gl_FragColor = vec4(col * t.a * vGlow, t.a * vGlow);
}
`;

export class Fireflies {
  points: THREE.Points;
  uniforms: { uTime: { value: number }; uNight: { value: number }; uHand: { value: THREE.Vector3 }; uCup: { value: number }; uPixelRatio: { value: number }; uMap: { value: THREE.Texture } };
  cupTarget = 0;
  /** Centres of the swarms (tree crowns), for CPU-side proximity checks. */
  private homes: THREE.Vector3[];

  constructor(trees: THREE.Vector3[], perTree: number) {
    this.homes = trees.map((t) => t.clone().add(new THREE.Vector3(0, 4.8, 0)));
    const r = rng(99);
    const n = trees.length * perTree;
    const home = new Float32Array(n * 3);
    const pos = new Float32Array(n * 3);
    const grp = new Float32Array(n);
    const seed = new Float32Array(n);
    let i = 0;
    trees.forEach((t, gi) => {
      for (let k = 0; k < perTree; k++) {
        const a = r() * Math.PI * 2;
        const rad = 0.8 + r() * 3.0;
        home[i * 3] = t.x + Math.cos(a) * rad;
        home[i * 3 + 1] = t.y + 3.2 + r() * 3.2;
        home[i * 3 + 2] = t.z + Math.sin(a) * rad;
        grp[i] = gi % 5;
        seed[i] = r();
        i++;
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aHome', new THREE.BufferAttribute(home, 3));
    geo.setAttribute('aGroup', new THREE.BufferAttribute(grp, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.uniforms = {
      uTime: { value: 0 },
      uNight: { value: 0 },
      uHand: { value: new THREE.Vector3() },
      uCup: { value: 0 },
      uPixelRatio: { value: Math.min(2, window.devicePixelRatio) },
      uMap: { value: softCircleTexture() },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: ffVert,
      fragmentShader: ffFrag,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 30;
  }

  update(dt: number, time: number, night: number, hand: THREE.Vector3) {
    this.uniforms.uTime.value = time;
    this.uniforms.uNight.value = night;
    this.uniforms.uHand.value.copy(hand);
    this.uniforms.uCup.value += (this.cupTarget - this.uniforms.uCup.value) * Math.min(1, dt * 1.5);
    this.points.visible = night > 0.02;
  }

  /** How many swarms have their centre within `radius` of a point. */
  nearCount(p: THREE.Vector3, radius: number) {
    let n = 0;
    for (const h of this.homes) if (h.distanceTo(p) < radius) n++;
    return n;
  }

  get cup() {
    return this.uniforms.uCup.value;
  }
}

// ---------------------------------------------------------------- ripples

export class Ripples {
  group = new THREE.Group();
  private pool: { mesh: THREE.Mesh; age: number; life: number; size: number }[] = [];

  constructor(count = 12) {
    const geo = new THREE.RingGeometry(0.8, 1, 24);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.group.add(m);
      this.pool.push({ mesh: m, age: 0, life: 1, size: 1 });
    }
  }

  spawn(x: number, y: number, z: number, size = 1, life = 1.4) {
    const p = this.pool.find((q) => !q.mesh.visible) ?? this.pool[0];
    p.mesh.position.set(x, y + 0.02, z);
    p.mesh.visible = true;
    p.age = 0;
    p.life = life;
    p.size = size;
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.mesh.visible) continue;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        p.mesh.visible = false;
        continue;
      }
      const s = 0.15 + t * p.size;
      p.mesh.scale.set(s, s, 1);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.5;
    }
  }
}
