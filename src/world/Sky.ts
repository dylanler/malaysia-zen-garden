import * as THREE from 'three';

const vert = /* glsl */ `
varying vec3 vWorldDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldDir = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uGlow;
uniform vec3 uMoonDir;
uniform float uMoon;
uniform float uStars;
uniform float uTime;
varying vec3 vWorldDir;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec3 d = normalize(vWorldDir);
  float t = pow(clamp(d.y, 0.0, 1.0), 0.5);
  vec3 col = mix(uHorizon, uTop, t);
  if (d.y < 0.0) col = mix(uHorizon, uHorizon * 0.75, clamp(-d.y * 5.0, 0.0, 1.0));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 5.0) * 0.28 + pow(sd, 90.0) * 0.9) * uGlow;
  float md = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.9993, 0.9996, md) * 1.6 + pow(md, 40.0) * 0.10) * uMoon;
  if (uStars > 0.001 && d.y > 0.0) {
    vec3 sp = floor(d * 260.0);
    float s = hash(sp);
    float star = step(0.9962, s) * (0.55 + 0.45 * sin(uTime * 1.7 + s * 200.0));
    col += vec3(star) * uStars * smoothstep(0.0, 0.3, d.y) * 0.9;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const WHITE = new THREE.Color('#ffffff');

export class Sky {
  group = new THREE.Group();
  material: THREE.ShaderMaterial;
  private mountainMat: THREE.MeshBasicMaterial;
  private cloudMat: THREE.MeshBasicMaterial;
  private clouds: THREE.Mesh[] = [];
  private dome: THREE.Mesh;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color('#4f8fd6') },
        uHorizon: { value: new THREE.Color('#cfe6f5') },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color('#ffffff') },
        uGlow: { value: 0.6 },
        uMoonDir: { value: new THREE.Vector3(0.3, 0.7, -0.6).normalize() },
        uMoon: { value: 0 },
        uStars: { value: 0 },
        uTime: { value: 0 },
      },
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(520, 32, 16), this.material);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    this.group.add(this.dome);

    // Kinabalu, keeping its head in the clouds, far to the north behind the padi.
    this.mountainMat = new THREE.MeshBasicMaterial({ color: '#5a6a8a', fog: false });
    const massif = new THREE.Group();
    const parts: [number, number, number, number][] = [
      // x offset, base radius, height, z offset
      [0, 120, 92, 0],
      [-70, 90, 78, 10],
      [65, 95, 84, -5],
      [-25, 50, 108, 4],
      [20, 45, 112, -2],
      [45, 40, 100, 3],
      [-130, 110, 60, 20],
      [130, 105, 58, 15],
    ];
    for (const [x, r, h, z] of parts) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1), this.mountainMat);
      m.position.set(x, h / 2 - 6, z);
      massif.add(m);
    }
    massif.position.set(0, 0, -400);
    massif.scale.set(1.15, 1, 1);
    this.group.add(massif);

    this.cloudMat = new THREE.MeshBasicMaterial({ color: '#f0e8e0', fog: false, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), this.cloudMat);
      c.scale.set(60 + i * 12, 12 + (i % 2) * 4, 30);
      c.position.set(-60 + i * 40, 88 + (i % 2) * 6, -400 + (i % 2) * 20);
      this.clouds.push(c);
      this.group.add(c);
    }
    this.group.frustumCulled = false;
  }

  update(time: number, cameraPos: THREE.Vector3, top: THREE.Color, horizon: THREE.Color) {
    this.material.uniforms.uTime.value = time;
    this.dome.position.copy(cameraPos);
    this.mountainMat.color.copy(horizon).lerp(top, 0.55).multiplyScalar(0.72);
    // clouds are lit by the sky around them: white by day, a faint smudge over the massif at night
    const lum = horizon.r * 0.2126 + horizon.g * 0.7152 + horizon.b * 0.0722;
    this.cloudMat.color.copy(horizon).lerp(WHITE, 0.5 * Math.min(1, lum / 0.5));
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.position.x += Math.sin(time * 0.05 + i) * 0.02;
    }
  }
}
