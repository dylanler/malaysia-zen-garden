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
uniform float uSpeed;
uniform sampler2D uNoise;
uniform vec3 uLight;
varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
  float t = uTime * uSpeed;
  // long streaks stretched down the sheet, a finer ripple over them, both accelerating toward the base
  float fallY = vUv.y + (1.0 - vUv.y) * (1.0 - vUv.y) * 0.35;
  float n = texture2D(uNoise, vec2(vUv.x * 1.2, fallY * 1.6 - t * 0.55)).r;
  float n2 = texture2D(uNoise, vec2(vUv.x * 3.5 + 0.3, fallY * 4.5 - t * 1.3)).r;
  float n3 = texture2D(uNoise, vec2(vUv.x * 7.0 - 0.2, fallY * 9.0 - t * 2.2)).r;
  float streak = smoothstep(0.32, 0.78, n * 0.5 + n2 * 0.32 + n3 * 0.18);
  // denser in the middle of the sheet, ragged at the sides
  float sideNoise = texture2D(uNoise, vec2(vUv.y * 2.0 - t * 0.2, 0.5)).r;
  float edge = smoothstep(0.0, 0.16 + sideNoise * 0.14, vUv.x) * smoothstep(1.0, 0.84 - sideNoise * 0.14, vUv.x);
  float core = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 2.4);
  // white water at the lip and where it hits the pool
  float lip = smoothstep(0.86, 0.97, vUv.y);
  float base = 1.0 - smoothstep(0.0, 0.14, vUv.y);
  float foam = max(lip, base * 0.5);
  float alpha = (0.32 + streak * 0.5 + foam * 0.4) * edge * (0.55 + core * 0.45);
  alpha *= mix(0.75, 1.0, smoothstep(0.0, 0.05, vUv.y));
  vec3 col = mix(vec3(0.70, 0.83, 0.93), vec3(1.0), clamp(streak + foam, 0.0, 1.0)) * uLight;
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;
const foamFrag = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
uniform sampler2D uNoise;
uniform vec3 uLight;
varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float a = atan(p.y, p.x) / 6.2832 + 0.5;
  // rings of froth pushed outward from where the water lands
  float n = texture2D(uNoise, vec2(a * 3.0, r * 1.4 - uTime * 0.28)).r;
  float n2 = texture2D(uNoise, vUv * 3.0 + vec2(uTime * 0.04, -uTime * 0.07)).r;
  float froth = smoothstep(0.42, 0.85, n * 0.55 + n2 * 0.45 + (1.0 - r) * 0.45);
  float alpha = froth * smoothstep(1.0, 0.4, r) * 0.55;
  gl_FragColor = vec4(uLight, alpha);
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

/**
 * A sheet of falling water: wider at the base than the top, drifting slightly forward as it falls,
 * and curling back over the lip through a quarter circle of radius `lip` at the top.
 */
function fallGeometry(width: number, height: number, lip: number, topTaper: number) {
  const geo = new THREE.PlaneGeometry(width, height, 8, 32);
  const pos = geo.attributes.position;
  const arcStart = 1 - (lip * 1.5708) / height; // the arc takes as much of the sheet as its length
  for (let i = 0; i < pos.count; i++) {
    const x0 = pos.getX(i);
    const v = THREE.MathUtils.clamp(pos.getY(i) / height + 0.5, 0, 1); // 0 at the base, 1 at the lip
    const taper = THREE.MathUtils.lerp(1.12, topTaper, Math.pow(v, 0.8));
    const wave = Math.sin(v * 11.0 + x0 * 2.0) * 0.035 * (1 - v);
    const x = x0 * taper + wave;
    let y: number;
    let z: number;
    if (v <= arcStart) {
      y = -height / 2 + (v / arcStart) * (height - lip);
      z = -(1 - v / arcStart) * 0.18;
    } else {
      const th = ((v - arcStart) / (1 - arcStart)) * Math.PI * 0.5;
      y = height / 2 - lip + Math.sin(th) * lip;
      z = (1 - Math.cos(th)) * lip;
    }
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export class AirTerjun extends Station {
  private fallMat!: THREE.ShaderMaterial;
  private fallMatBack!: THREE.ShaderMaterial;
  private foamMat!: THREE.ShaderMaterial;
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

    // ---------------- cliff: a face of stacked columns leaning back with height, a channel for the fall,
    // a sill of rock the water curls over, and mossy ledges
    // the face is in its own shade all day, so the rock is kept pale and given a breath of emissive light
    const rockMat = mat('#959ca4', { roughness: 0.9 });
    rockMat.emissive = new THREE.Color('#151b21');
    const rockDark = mat('#7a828a', { roughness: 0.94 });
    rockDark.emissive = new THREE.Color('#0f1419');
    const mossMat = mat('#587a52', { roughness: 0.95 });
    mossMat.emissive = new THREE.Color('#0a120a');
    const cliff = new THREE.Group();
    const FACE_Z = 7.3;
    const CLIFF_TOP = 8.2;
    const FALL_X = 1.0;
    const LEAN = 0.08; // metres back per metre up
    const columns = [-4.6, -3.0, -1.5, -0.1, 1.3, 2.7, 4.1, 5.5];
    for (const cx of columns) {
      const inChannel = Math.abs(cx - FALL_X) < 1.4;
      // the skyline falls away from the fall on both sides
      const shoulderDrop = 0.16 * Math.pow(Math.max(0, Math.abs(cx - FALL_X) - 1.4), 1.5);
      const top = inChannel ? CLIFF_TOP - 0.55 : CLIFF_TOP - shoulderDrop + (Math.random() - 0.5) * 0.4;
      let y = -0.6;
      while (y < top) {
        const h = Math.min(1.3 + Math.random() * 1.4, top - y + 0.3);
        const w = 1.55 + Math.random() * 0.4;
        const d = 2.8;
        const proud = inChannel ? -0.5 : (Math.random() - 0.5) * 0.5;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Math.random() < 0.35 ? rockDark : rockMat);
        const cy = y + h / 2;
        slab.position.set(cx + (Math.random() - 0.5) * 0.2, cy, FACE_Z + d / 2 + proud + Math.max(0, cy) * LEAN);
        slab.rotation.y = (Math.random() - 0.5) * 0.14;
        slab.rotation.x = (Math.random() - 0.5) * 0.05;
        shadow(slab);
        cliff.add(slab);
        y += h * 0.9;
      }
    }
    // the sill the water pours over, and the shoulders either side of the channel
    const sill = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 2.0), rockDark);
    sill.position.set(FALL_X, CLIFF_TOP - 0.3, FACE_Z + 1.2 + CLIFF_TOP * LEAN);
    sill.rotation.x = -0.06;
    shadow(sill);
    cliff.add(sill);
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.6), rockMat);
      shoulder.position.set(FALL_X + side * 1.95, CLIFF_TOP - 0.25, FACE_Z + 0.55 + CLIFF_TOP * LEAN);
      shoulder.rotation.set((Math.random() - 0.5) * 0.1, side * 0.15, side * 0.08);
      shadow(shoulder);
      cliff.add(shoulder);
    }
    // ledges with moss, away from the channel
    for (let k = 0; k < 14; k++) {
      const lx = -4.8 + Math.random() * 10.2;
      if (Math.abs(lx - FALL_X) < 1.7) continue;
      const ly = 0.6 + Math.random() * (CLIFF_TOP - 1.4);
      const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.5, 0), mossMat);
      moss.position.set(lx, ly, FACE_Z - 0.15 + ly * LEAN);
      moss.scale.set(1.2, 0.45, 0.6);
      moss.rotation.y = Math.random() * Math.PI;
      cliff.add(moss);
    }
    // a fringe of green along the top edge, following the skyline
    for (let k = 0; k < 9; k++) {
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + Math.random() * 0.6, 0), mossMat);
      const bx = -5 + k * 1.3 + Math.random() * 0.6;
      const drop = 0.16 * Math.pow(Math.max(0, Math.abs(bx - FALL_X) - 1.4), 1.5);
      bush.position.set(bx, CLIFF_TOP - drop + 0.3, FACE_Z + 0.8 + CLIFF_TOP * LEAN + Math.random() * 0.8);
      bush.scale.set(1, 0.7, 1);
      cliff.add(bush);
    }
    // talus: broken rock heaped where the face meets the ground, softening the corners
    for (let k = 0; k < 16; k++) {
      const side = k % 2 === 0 ? -1 : 1;
      const tx = FALL_X + side * (3.0 + Math.random() * 3.6);
      const tz = FACE_Z - 0.4 - Math.random() * 1.8;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + Math.random() * 0.7, 0), Math.random() < 0.3 ? mossMat : rockMat);
      this.settle(rock, tx, tz, 0.05);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.scale.set(1, 0.7 + Math.random() * 0.4, 1);
      shadow(rock);
      g.add(rock);
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
    const shared = { uTime: { value: 0 }, uNoise: { value: noiseTexture(256, 7) }, uLight: { value: new THREE.Color('#ffffff') } };
    const waterShader = (frag: string, speed: number) =>
      new THREE.ShaderMaterial({
        vertexShader: fallVert,
        fragmentShader: frag,
        uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...shared, uSpeed: { value: speed } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
      });
    this.fallMat = waterShader(fallFrag, 1.0);
    this.fallMatBack = waterShader(fallFrag, 0.72);
    this.foamMat = waterShader(foamFrag, 1.0);
    // the main sheet: base in the pool, top curling back over the sill
    const fallZ = FACE_Z - 0.55;
    const fallTop = CLIFF_TOP + 0.2;
    const fallH = fallTop - this.poolY;
    const fall = new THREE.Mesh(fallGeometry(1.9, fallH, 1.0, 0.7), this.fallMat);
    fall.position.set(FALL_X, this.poolY + fallH / 2, fallZ);
    fall.renderOrder = 5;
    g.add(fall);
    // a thinner sheet just behind it, falling a touch slower, gives the water some depth
    const back = new THREE.Mesh(fallGeometry(1.5, fallH - 0.1, 0.9, 0.5), this.fallMatBack);
    back.position.set(FALL_X + 0.1, this.poolY + fallH / 2 - 0.05, fallZ + 0.22);
    back.renderOrder = 4;
    g.add(back);
    // a side trickle off a ledge to the right, landing at the pool's edge
    const trickleH = 5.4;
    const trickleX = FALL_X + 2.6;
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.4), rockDark);
    ledge.position.set(trickleX, this.poolY + trickleH - 0.25, FACE_Z + 0.35 + trickleH * LEAN);
    shadow(ledge);
    cliff.add(ledge);
    const fall2 = new THREE.Mesh(fallGeometry(0.5, trickleH, 0.5, 0.6), this.fallMat);
    fall2.position.set(trickleX, this.poolY + trickleH / 2, FACE_Z - 0.4 + trickleH * LEAN * 0.5);
    fall2.renderOrder = 5;
    g.add(fall2);

    const poolMat = this.ctx.water.track(makeWaterMaterial({ scale: 0.6, opacity: 0.86 }));
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.35, 32), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(this.poolCenter.x, this.poolY, this.poolCenter.z);
    pool.renderOrder = 2;
    g.add(pool);
    // foam where the water lands, churning outward
    const foam = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), this.foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.scale.set(1.9, 1.25, 1);
    foam.position.set(FALL_X, this.poolY + 0.02, fallZ - 0.25);
    foam.renderOrder = 3;
    g.add(foam);
    // splash mist at the base
    this.mist = new Emitter({
      count: 120,
      color: '#ffffff',
      size: 1.6,
      life: [2.0, 3.4],
      spawn: () => new THREE.Vector3(FALL_X + (Math.random() - 0.5) * 2.4, this.poolY + 0.1, fallZ - 0.1 + (Math.random() - 0.5) * 0.8),
      velocity: () => new THREE.Vector3((Math.random() - 0.5) * 0.45, 0.4 + Math.random() * 0.35, -0.3 - Math.random() * 0.35),
      drag: 0.5,
      opacity: 0.1,
    });
    this.mist.rate = 22;
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
