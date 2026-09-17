import * as THREE from 'three';
import { clamp, degToRad, lerp, smoothstep } from './util';
import type { Sky } from '../world/Sky';
import type { Water } from '../world/Water';

interface Key {
  hour: number;
  top: string;
  horizon: string;
  sun: string;
  sunI: number;
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
  fog: string;
  fogD: number;
  water: string;
  stars: number;
  elev: number;
  glow: number;
  exposure: number;
}

const KEYS: Key[] = [
  { hour: 0, top: '#0a0e2a', horizon: '#1a2547', sun: '#a9bbff', sunI: 0.3, hemiSky: '#26305a', hemiGround: '#141a24', hemiI: 0.55, fog: '#131b33', fogD: 0.016, water: '#0d1630', stars: 1, elev: -25, glow: 0, exposure: 0.9 },
  { hour: 5.5, top: '#2b2f66', horizon: '#7a5a7e', sun: '#ffb88a', sunI: 0.2, hemiSky: '#5a5a96', hemiGround: '#2a2e2a', hemiI: 0.55, fog: '#4a4260', fogD: 0.015, water: '#2b3358', stars: 0.5, elev: -4, glow: 0.5, exposure: 0.95 },
  { hour: 6.75, top: '#6b6fb5', horizon: '#f7c9a8', sun: '#ffd2a8', sunI: 0.95, hemiSky: '#b8b4e8', hemiGround: '#6a6f5a', hemiI: 0.75, fog: '#d9c4d8', fogD: 0.012, water: '#6f7fa6', stars: 0.12, elev: 8, glow: 1.0, exposure: 1.0 },
  { hour: 9.5, top: '#4f8fd6', horizon: '#cfe6f5', sun: '#fff2dc', sunI: 1.5, hemiSky: '#9fc7ee', hemiGround: '#77925a', hemiI: 0.85, fog: '#cfe0ea', fogD: 0.008, water: '#4d86a8', stars: 0, elev: 40, glow: 0.6, exposure: 1.0 },
  { hour: 12.5, top: '#3f86d8', horizon: '#d8ecf7', sun: '#ffffff', sunI: 1.7, hemiSky: '#a8cff0', hemiGround: '#6f9550', hemiI: 0.9, fog: '#cbe3ea', fogD: 0.007, water: '#3f8aa0', stars: 0, elev: 72, glow: 0.5, exposure: 1.0 },
  { hour: 15.5, top: '#5f7a8a', horizon: '#9fb0b8', sun: '#c9d3d8', sunI: 0.55, hemiSky: '#8fa3ad', hemiGround: '#5a6a5a', hemiI: 0.8, fog: '#97a9b0', fogD: 0.02, water: '#5a7480', stars: 0, elev: 45, glow: 0.1, exposure: 0.95 },
  { hour: 17.5, top: '#6a8fc9', horizon: '#ffc98a', sun: '#ffb35c', sunI: 1.3, hemiSky: '#c9b7a8', hemiGround: '#7a7a45', hemiI: 0.8, fog: '#e8c9a0', fogD: 0.01, water: '#7a8fa0', stars: 0, elev: 12, glow: 1.0, exposure: 1.0 },
  { hour: 18.5, top: '#4a4f8f', horizon: '#ff8a5b', sun: '#ff7a3d', sunI: 0.9, hemiSky: '#8f7aa8', hemiGround: '#5a4a4a', hemiI: 0.7, fog: '#d99a86', fogD: 0.011, water: '#6a5f88', stars: 0.05, elev: 3, glow: 1.0, exposure: 1.0 },
  { hour: 19.25, top: '#24285a', horizon: '#c96a7a', sun: '#b05a70', sunI: 0.35, hemiSky: '#5a5f9a', hemiGround: '#3a3a4a', hemiI: 0.6, fog: '#6f5f86', fogD: 0.013, water: '#3a3f6a', stars: 0.4, elev: -3, glow: 0.6, exposure: 0.95 },
  { hour: 21, top: '#0a0e2a', horizon: '#1a2547', sun: '#a9bbff', sunI: 0.3, hemiSky: '#26305a', hemiGround: '#141a24', hemiI: 0.55, fog: '#16203a', fogD: 0.015, water: '#0d1630', stars: 1, elev: -25, glow: 0, exposure: 0.9 },
  { hour: 24, top: '#0a0e2a', horizon: '#1a2547', sun: '#a9bbff', sunI: 0.3, hemiSky: '#26305a', hemiGround: '#141a24', hemiI: 0.55, fog: '#131b33', fogD: 0.016, water: '#0d1630', stars: 1, elev: -25, glow: 0, exposure: 0.9 },
];

const parsed = KEYS.map((k) => ({
  ...k,
  cTop: new THREE.Color(k.top),
  cHorizon: new THREE.Color(k.horizon),
  cSun: new THREE.Color(k.sun),
  cHemiSky: new THREE.Color(k.hemiSky),
  cHemiGround: new THREE.Color(k.hemiGround),
  cFog: new THREE.Color(k.fog),
  cWater: new THREE.Color(k.water),
}));

export class TimeOfDay {
  hour = 6.75;
  top = new THREE.Color();
  horizon = new THREE.Color();
  sunColor = new THREE.Color();
  waterColor = new THREE.Color();
  sunDir = new THREE.Vector3(0, 1, 0);
  stars = 0;
  /** 0 by day, 1 at night. */
  night = 0;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  fog: THREE.FogExp2;
  /** Multiplier for fog density (weather). */
  fogBoost = 1;
  /** Dims the sun and desaturates a little (weather). */
  overcast = 0;
  private from = 6.75;
  private to = 6.75;
  private t = 1;
  private duration = 1;
  private moonDir = new THREE.Vector3(0.35, 0.72, -0.6).normalize();
  private shadowTarget = new THREE.Object3D();

  constructor(
    private scene: THREE.Scene,
    private renderer: THREE.WebGLRenderer,
    private sky: Sky,
    private water: Water,
    shadows: boolean,
  ) {
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.castShadow = shadows;
    if (shadows) {
      this.sun.shadow.mapSize.set(2048, 2048);
      const c = this.sun.shadow.camera;
      c.left = -42;
      c.right = 42;
      c.top = 42;
      c.bottom = -42;
      c.near = 1;
      c.far = 220;
      this.sun.shadow.bias = -0.0006;
      this.sun.shadow.normalBias = 0.03;
    }
    this.sun.target = this.shadowTarget;
    scene.add(this.sun, this.shadowTarget);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    scene.add(this.hemi);
    this.fog = new THREE.FogExp2(0xcfe0ea, 0.008);
    scene.fog = this.fog;
    this.apply();
  }

  setHour(h: number) {
    this.hour = ((h % 24) + 24) % 24;
    this.from = this.to = this.hour;
    this.t = 1;
    this.apply();
  }

  /** Tween forward in time to the target hour (always moving the day forward). */
  tweenTo(h: number, seconds: number) {
    const cur = this.hour;
    let target = ((h % 24) + 24) % 24;
    if (target < cur - 0.01) target += 24;
    if (Math.abs(target - cur) < 0.01) return;
    this.from = cur;
    this.to = target;
    this.t = 0;
    this.duration = Math.max(0.1, seconds);
  }

  get tweening() {
    return this.t < 1;
  }

  update(dt: number, time: number, cameraPos: THREE.Vector3) {
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.duration);
      const e = this.t * this.t * (3 - 2 * this.t);
      this.hour = lerp(this.from, this.to, e) % 24;
    }
    this.apply();
    // shadow frustum follows the player
    const tx = Math.round(cameraPos.x / 2) * 2;
    const tz = Math.round(cameraPos.z / 2) * 2;
    this.shadowTarget.position.set(tx, 0, tz);
    this.sun.position.copy(this.sunDir).multiplyScalar(90).add(this.shadowTarget.position);
    this.sky.update(time, cameraPos, this.top, this.horizon);
    this.water.update(time, this.waterColor, this.horizon, this.sunDir, this.sunColor);
  }

  private apply() {
    const h = this.hour;
    let i = 0;
    while (i < parsed.length - 2 && parsed[i + 1].hour <= h) i++;
    const a = parsed[i];
    const b = parsed[i + 1];
    const t = clamp((h - a.hour) / (b.hour - a.hour), 0, 1);
    const s = t * t * (3 - 2 * t);
    this.top.lerpColors(a.cTop, b.cTop, s);
    this.horizon.lerpColors(a.cHorizon, b.cHorizon, s);
    this.sunColor.lerpColors(a.cSun, b.cSun, s);
    this.waterColor.lerpColors(a.cWater, b.cWater, s);
    const sunI = lerp(a.sunI, b.sunI, s);
    const hemiI = lerp(a.hemiI, b.hemiI, s);
    const fogD = lerp(a.fogD, b.fogD, s);
    this.stars = lerp(a.stars, b.stars, s);
    const elev = lerp(a.elev, b.elev, s);
    const glow = lerp(a.glow, b.glow, s);
    const exposure = lerp(a.exposure, b.exposure, s);
    this.night = smoothstep(4, -8, elev);

    // direction to the sun; azimuth swings from east (dawn) to west (dusk)
    const az = degToRad(lerp(-105, 105, clamp((h - 6) / 12.5, 0, 1)));
    const el = degToRad(elev);
    const sunDir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    // blend toward the moon when the sun is down
    const moonMix = smoothstep(3, -6, elev);
    this.sunDir.copy(sunDir).lerp(this.moonDir, moonMix).normalize();

    const overcast = this.overcast;
    this.sun.color.copy(this.sunColor).lerp(new THREE.Color('#c9d3d8'), overcast * 0.6);
    this.sun.intensity = sunI * lerp(1, 0.4, overcast);
    this.hemi.color.lerpColors(a.cHemiSky, b.cHemiSky, s).lerp(new THREE.Color('#8fa3ad'), overcast * 0.5);
    this.hemi.groundColor.lerpColors(a.cHemiGround, b.cHemiGround, s);
    this.hemi.intensity = hemiI * lerp(1, 0.85, overcast);
    this.fog.color.lerpColors(a.cFog, b.cFog, s).lerp(new THREE.Color('#97a9b0'), overcast * 0.7);
    this.fog.density = fogD * this.fogBoost;
    this.renderer.toneMappingExposure = exposure;

    const u = this.sky.material.uniforms;
    (u.uTop.value as THREE.Color).copy(this.top).lerp(new THREE.Color('#5f7a8a'), overcast * 0.6);
    (u.uHorizon.value as THREE.Color).copy(this.horizon).lerp(new THREE.Color('#9fb0b8'), overcast * 0.6);
    (u.uSunDir.value as THREE.Vector3).copy(sunDir);
    (u.uSunColor.value as THREE.Color).copy(this.sunColor);
    u.uGlow.value = glow * (1 - overcast * 0.9);
    u.uStars.value = this.stars * (1 - overcast);
    u.uMoon.value = moonMix;
    (u.uMoonDir.value as THREE.Vector3).copy(this.moonDir);
  }
}
