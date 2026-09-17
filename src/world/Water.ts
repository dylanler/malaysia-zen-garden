import * as THREE from 'three';
import { noiseTexture } from './textures';
import { LAKE_RADIUS } from '../content/stations';
import { WATER_Y } from './Terrain';

const vert = /* glsl */ `
varying vec3 vWorldPos;
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vUv = uv;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const frag = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform sampler2D uNoise;
uniform float uScale;
uniform vec2 uFlow;
uniform float uOpacity;
varying vec3 vWorldPos;
varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
  vec2 uv = vWorldPos.xz * uScale + uFlow * uTime;
  float n1 = texture2D(uNoise, uv + vec2(uTime * 0.012, uTime * 0.008)).r;
  float n2 = texture2D(uNoise, uv * 1.9 - vec2(uTime * 0.011, -uTime * 0.014)).r;
  vec3 nrm = normalize(vec3((n1 - 0.5) * 0.35, 1.0, (n2 - 0.5) * 0.35));
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fres = pow(1.0 - max(dot(viewDir, nrm), 0.0), 3.0);
  vec3 col = mix(uDeep, uSky, 0.3 + fres * 0.6);
  vec3 h = normalize(viewDir + uSunDir);
  float spec = pow(max(dot(nrm, h), 0.0), 160.0);
  col += uSunColor * spec * 0.8;
  // ripple highlights are lit by the sky, so they dim with it at night
  float skyLum = clamp(dot(uSky, vec3(0.2126, 0.7152, 0.0722)) * 2.0, 0.05, 1.0);
  col += vec3(0.05) * skyLum * smoothstep(0.62, 0.78, n1 * 0.5 + n2 * 0.5);
  gl_FragColor = vec4(col, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export function makeWaterMaterial(opts: { scale?: number; flow?: THREE.Vector2; opacity?: number } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color('#3f8aa0') },
        uSky: { value: new THREE.Color('#cfe6f5') },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color('#ffffff') },
        uNoise: { value: noiseTexture(256, 4) },
        uScale: { value: opts.scale ?? 0.05 },
        uFlow: { value: opts.flow ?? new THREE.Vector2(0, 0) },
        uOpacity: { value: opts.opacity ?? 0.94 },
      },
    ]),
  });
}

export class Water {
  mesh: THREE.Mesh;
  materials: THREE.ShaderMaterial[] = [];

  constructor() {
    const mat = makeWaterMaterial();
    this.materials.push(mat);
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(LAKE_RADIUS + 1.5, 64), mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = WATER_Y;
    this.mesh.renderOrder = 1;
    this.mesh.name = 'lake';
  }

  /** Register another water-shader material (pools, drains) so palette updates reach it. */
  track(mat: THREE.ShaderMaterial) {
    this.materials.push(mat);
    return mat;
  }

  update(time: number, deep: THREE.Color, sky: THREE.Color, sunDir: THREE.Vector3, sunColor: THREE.Color) {
    for (const m of this.materials) {
      m.uniforms.uTime.value = time;
      (m.uniforms.uDeep.value as THREE.Color).copy(deep);
      (m.uniforms.uSky.value as THREE.Color).copy(sky);
      (m.uniforms.uSunDir.value as THREE.Vector3).copy(sunDir);
      (m.uniforms.uSunColor.value as THREE.Color).copy(sunColor);
    }
  }
}
