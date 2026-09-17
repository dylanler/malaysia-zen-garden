import * as THREE from 'three';
import { Station } from './Station';
import { box, cyl, lathe, mat, slippers, shadow } from '../world/props';
import { weaveTexture, floralTexture, noiseTexture } from '../world/textures';
import { makeWaterMaterial } from '../world/Water';
import { Emitter } from '../world/Particles';
import type { Interactable } from '../core/Interaction';

const fallVert = /* glsl */ `
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;
const fallFrag = /* glsl */ `
uniform float uTime;
uniform sampler2D uNoise;
uniform vec3 uLight;
varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
  float n = texture2D(uNoise, vec2(vUv.x * 1.5, vUv.y * 2.5 - uTime * 0.9)).r;
  float n2 = texture2D(uNoise, vec2(vUv.x * 3.0 + 0.3, vUv.y * 4.0 - uTime * 1.5)).r;
  float streak = smoothstep(0.3, 0.8, n * 0.6 + n2 * 0.4);
  float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
  float bottom = smoothstep(0.0, 0.12, vUv.y);
  float alpha = (0.4 + streak * 0.55) * edge * mix(1.0, 0.5, 1.0 - bottom);
  vec3 col = mix(vec3(0.72, 0.84, 0.94), vec3(1.0), streak) * uLight;
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

interface Stone {
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  state: 'shore' | 'hand' | 'air' | 'sunk';
  vel: THREE.Vector3;
  bounces: number;
}

export class AirTerjun extends Station {
  private fallMat!: THREE.ShaderMaterial;
  private mist!: Emitter;
  private poolCenter = new THREE.Vector3(1.2, 0, 5.2); // local
  private poolY = 0;
  private stones: Stone[] = [];
  private handStone: Stone | null = null;
  private handHolder = new THREE.Group();
  private skips = 0;
  private handInteractable: Interactable | null = null;
  private satMemory = false;
  private thermosSteam!: Emitter;

  build() {
    const g = this.group;
    const padH = this.center.y;
    this.poolY = -0.32;

    // ---------------- cliff
    const rockMat = mat('#6f757c', { roughness: 0.95 });
    const mossMat = mat('#587a52', { roughness: 0.95 });
    const cliff = new THREE.Group();
    const tiers: [number, number, number, number, number][] = [
      // x, y, z, width, height
      [0, 1.2, 8.6, 9, 2.4],
      [0.4, 3.4, 9.2, 8, 2.2],
      [-0.3, 5.4, 9.8, 7, 2.0],
      [0.6, 7.0, 10.6, 6, 1.6],
    ];
    for (const [x, y, z, w, h] of tiers) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3.2), rockMat);
      slab.position.set(x, y, z);
      slab.rotation.y = (Math.random() - 0.5) * 0.15;
      shadow(slab);
      cliff.add(slab);
      for (let k = 0; k < 4; k++) {
        const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + Math.random() * 0.5, 0), mossMat);
        moss.position.set(x + (Math.random() - 0.5) * w * 0.9, y + (Math.random() - 0.5) * h, z - 1.6);
        moss.scale.set(1, 0.5, 0.6);
        cliff.add(moss);
      }
    }
    // boulders around the pool rim
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 3.2 + Math.random() * 0.8;
      const bx = this.poolCenter.x + Math.cos(a) * r;
      const bz = this.poolCenter.z + Math.sin(a) * r;
      if (bz < 1.6) continue; // keep the path clear
      const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + Math.random() * 0.5, 0), Math.random() < 0.3 ? mossMat : rockMat);
      this.settle(b, bx, bz, 0.1);
      b.rotation.set(Math.random(), Math.random(), Math.random());
      shadow(b);
      g.add(b);
    }
    g.add(cliff);

    // ---------------- the fall and the pool
    this.fallMat = new THREE.ShaderMaterial({
      vertexShader: fallVert,
      fragmentShader: fallFrag,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uTime: { value: 0 }, uNoise: { value: noiseTexture(256, 7) }, uLight: { value: new THREE.Color('#ffffff') } },
      ]),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    const fallH = 8.4;
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.7, fallH, 1, 8), this.fallMat);
    fall.position.set(this.poolCenter.x + 0.2, this.poolY + fallH / 2 - 0.2, 6.9);
    fall.renderOrder = 5;
    g.add(fall);
    const fall2 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, fallH * 0.7, 1, 4), this.fallMat);
    fall2.position.set(this.poolCenter.x - 1.6, this.poolY + (fallH * 0.7) / 2 + 1.4, 7.1);
    fall2.renderOrder = 5;
    g.add(fall2);
    const poolMat = this.ctx.water.track(makeWaterMaterial({ scale: 0.6, opacity: 0.86 }));
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.35, 32), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(this.poolCenter.x, this.poolY, this.poolCenter.z);
    pool.renderOrder = 2;
    g.add(pool);
    // splash mist at the base
    this.mist = new Emitter({
      count: 90,
      color: '#ffffff',
      size: 1.4,
      life: [2.2, 3.6],
      spawn: () => new THREE.Vector3(this.poolCenter.x + (Math.random() - 0.5) * 2.2, this.poolY + 0.1, 6.4 + (Math.random() - 0.5) * 0.8),
      velocity: () => new THREE.Vector3((Math.random() - 0.5) * 0.35, 0.35 + Math.random() * 0.3, -0.25 - Math.random() * 0.3),
      drag: 0.5,
      opacity: 0.11,
    });
    this.mist.rate = 18;
    g.add(this.mist.points);

    // waterfall sound emitters (world space)
    const fallWorld = this.local(this.poolCenter.x, 0, 6.5);
    this.ctx.ambience.emitters.push({ layer: 'water', pos: fallWorld, radius: 36, gain: 0.8 }, { layer: 'spray', pos: fallWorld, radius: 12, gain: 0.35 });

    // ---------------- the flat rock with the tikar
    const flat = box(2.6, 0.5, 1.7, '#7a7f86');
    this.settle(flat, -2.4, 3.4, 0.25);
    flat.rotation.y = 0.25;
    g.add(flat);
    const tikar = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), mat('#c9a86a', { map: weaveTexture() }));
    tikar.rotation.x = -Math.PI / 2;
    tikar.rotation.z = 0.25;
    tikar.receiveShadow = true;
    tikar.position.copy(flat.position).add(new THREE.Vector3(0.1, 0.26, 0));
    g.add(tikar);
    const thermos = lathe(
      [
        [0, 0],
        [0.09, 0],
        [0.1, 0.28],
        [0.07, 0.31],
        [0.07, 0.35],
      ],
      14,
      '#f2e9db',
      { map: floralTexture(), roughness: 0.4 },
    );
    thermos.position.copy(tikar.position).add(new THREE.Vector3(-0.6, 0.01, -0.3));
    g.add(thermos);
    const tupper = box(0.32, 0.12, 0.22, '#c9e0e8', { transparent: true, opacity: 0.7, roughness: 0.3 });
    tupper.position.copy(tikar.position).add(new THREE.Vector3(0.45, 0.07, -0.25));
    const tupperLid = box(0.34, 0.02, 0.24, '#d8262f');
    tupperLid.position.copy(tupper.position).add(new THREE.Vector3(0, 0.07, 0));
    g.add(tupper, tupperLid);
    const cupA = cyl(0.035, 0.03, 0.06, 10, '#f6efe2');
    cupA.position.copy(tikar.position).add(new THREE.Vector3(-0.35, 0.03, 0.1));
    g.add(cupA);
    this.thermosSteam = new Emitter({
      count: 20,
      color: '#ffffff',
      size: 0.12,
      life: [0.8, 1.4],
      spawn: () => cupA.position.clone().add(new THREE.Vector3(0, 0.04, 0)),
      velocity: () => new THREE.Vector3((Math.random() - 0.5) * 0.03, 0.12, (Math.random() - 0.5) * 0.03),
      opacity: 0.18,
    });
    this.thermosSteam.rate = 4;
    g.add(this.thermosSteam.points);
    const slip = slippers('#e8c840');
    slip.position.copy(flat.position).add(new THREE.Vector3(-1.5, -0.2, 0.6));
    slip.position.y = this.groundAt(slip.position.x, slip.position.z) + 0.02;
    g.add(slip);
    const seatEye = tikar.position.clone().add(new THREE.Vector3(0, 0.95, 0));
    const seatLook = new THREE.Vector3(this.poolCenter.x, 1.6, 7);
    this.addSeat('tikar', flat, seatEye, seatLook, 'Tap to sit on the tikar', () => {
      this.ctx.ui.setHint(null);
    });

    // ---------------- skipping stones on the shore
    this.ctx.camera.add(this.handHolder);
    this.handHolder.position.set(0.22, -0.2, -0.5);
    const stoneMat = mat('#8a8f96', { roughness: 0.8 });
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09, 0), stoneMat);
      m.scale.set(1.1, 0.35, 1);
      const home = new THREE.Vector3(-0.9 + i * 0.35, 0, 1.9 + (i % 2) * 0.25);
      this.settle(m, home.x, home.z, 0.04);
      home.copy(m.position);
      m.rotation.y = Math.random() * 3;
      g.add(m);
      const stone: Stone = { mesh: m, home, state: 'shore', vel: new THREE.Vector3(), bounces: 0 };
      this.stones.push(stone);
    }
    const shoreProxy = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 0.8), mat('#000000'));
    shoreProxy.visible = false;
    this.settle(shoreProxy, -0.2, 2.0, 0.1);
    g.add(shoreProxy);
    this.add({
      id: 'airterjun-stones',
      object: shoreProxy,
      gestures: ['tap'],
      hint: 'Tap to pick up a flat stone',
      markerSize: 0.3,
      enabled: () => !this.handStone && this.stones.some((s) => s.state === 'shore') && this.seatedId === null,
      onTap: () => this.pickStone(),
    });
  }

  private pickStone() {
    const s = this.stones.find((st) => st.state === 'shore');
    if (!s) return;
    s.state = 'hand';
    this.handStone = s;
    this.group.remove(s.mesh);
    s.mesh.position.set(0, 0, 0);
    s.mesh.rotation.set(0.3, 0.2, 0);
    this.handHolder.add(s.mesh);
    this.ctx.synth.stoneClick();
    this.handInteractable = this.add({
      id: 'airterjun-handstone',
      object: this.handHolder,
      gestures: ['drag', 'flick'],
      hint: 'Flick the stone toward the pool',
      range: 3,
      markerSize: 0.25,
      onDrag: () => {},
      onDragEnd: (vx, vy) => this.throwStone(vx, vy, false),
      onFlick: (vx, vy) => this.throwStone(vx, vy, true),
    });
  }

  private throwStone(vx: number, vy: number, flick: boolean) {
    const s = this.handStone;
    if (!s) return;
    if (!flick && Math.hypot(vx, vy) < 0.4) return; // a lazy drag: keep holding
    this.handStone = null;
    if (this.handInteractable) this.remove(this.handInteractable);
    this.handInteractable = null;
    const cam = this.ctx.camera;
    const world = this.handHolder.getWorldPosition(new THREE.Vector3());
    this.handHolder.remove(s.mesh);
    this.group.add(s.mesh);
    s.mesh.position.copy(this.group.worldToLocal(world.clone()));
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    fwd.y = 0;
    fwd.normalize();
    const speed = THREE.MathUtils.clamp(4 + Math.hypot(vx, vy) * 3, 4, 10);
    const vel = fwd.multiplyScalar(speed);
    vel.y = 1.2 + Math.max(0, -vy) * 1.5;
    // into station-local space
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.angle);
    s.vel.copy(vel.applyQuaternion(q));
    s.state = 'air';
    s.bounces = 0;
    this.ctx.synth.leaf(0.2);
  }

  private respawn(s: Stone) {
    window.setTimeout(() => {
      s.state = 'shore';
      s.mesh.visible = true;
      s.mesh.position.copy(s.home);
      s.mesh.scale.set(1.1, 0.35, 1);
    }, 4000);
  }

  override exit() {
    super.exit();
    // the rain gathers once you leave the waterfall
    this.ctx.weather.gather();
    if (this.handStone) {
      const s = this.handStone;
      this.handStone = null;
      if (this.handInteractable) this.remove(this.handInteractable);
      this.handInteractable = null;
      this.handHolder.remove(s.mesh);
      this.group.add(s.mesh);
      s.state = 'shore';
      s.mesh.position.copy(s.home);
    }
  }

  override update(dt: number, time: number) {
    this.tickSeat(dt);
    this.fallMat.uniforms.uTime.value = time;
    // the falling water is lit by the sky and the sun (or moon), so it dims with the day
    const t = this.ctx.time;
    const light = this.fallMat.uniforms.uLight.value as THREE.Color;
    light.copy(t.hemi.color).multiplyScalar(t.hemi.intensity * 1.2);
    light.r = Math.min(1, light.r + t.sun.color.r * t.sun.intensity * 0.5);
    light.g = Math.min(1, light.g + t.sun.color.g * t.sun.intensity * 0.5);
    light.b = Math.min(1, light.b + t.sun.color.b * t.sun.intensity * 0.5);
    this.mist.update(dt);
    this.thermosSteam.update(dt);
    if (this.seatedId && this.sitTime > 7 && !this.satMemory) {
      this.satMemory = true;
      this.complete('sit');
    }
    // stones in flight
    for (const s of this.stones) {
      if (s.state !== 'air') continue;
      s.vel.y -= 9.8 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.y += dt * 6;
      const p = s.mesh.position;
      const dPool = Math.hypot(p.x - this.poolCenter.x, p.z - this.poolCenter.z);
      const overPool = dPool < 3.2;
      const groundY = overPool ? this.poolY : this.groundAt(p.x, p.z);
      if (p.y <= groundY + 0.03 && s.vel.y < 0) {
        if (overPool) {
          const w = this.local(p.x, this.poolY, p.z);
          const horiz = Math.hypot(s.vel.x, s.vel.z);
          if (horiz > 2.2 && s.bounces < 4) {
            s.bounces++;
            this.skips++;
            s.vel.y = Math.abs(s.vel.y) * 0.55;
            s.vel.x *= 0.72;
            s.vel.z *= 0.72;
            p.y = this.poolY + 0.04;
            this.ctx.ripples.spawn(w.x, w.y, w.z, 1.2, 1.2);
            this.ctx.synth.splash(0.35);
            this.ctx.music.play('plink', 8 + s.bounces * 2, 0.6);
            if (this.skips >= 3) this.complete('stones');
          } else {
            s.state = 'sunk';
            s.mesh.visible = false;
            this.ctx.ripples.spawn(w.x, w.y, w.z, 1.8, 1.6);
            this.ctx.synth.splash(0.7);
            this.ctx.music.play('plink', 5, 0.5);
            this.respawn(s);
          }
        } else {
          s.state = 'sunk';
          p.y = groundY + 0.03;
          this.ctx.synth.stoneClick();
          this.respawn(s);
        }
      }
    }
  }
}
