import * as THREE from 'three';
import { flameTexture, softCircleTexture } from './textures';

const matCache = new Map<string, THREE.MeshStandardMaterial>();

export interface MatOpts {
  flat?: boolean;
  roughness?: number;
  metalness?: number;
  map?: THREE.Texture;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
}

/** Shared flat-shaded standard material by colour (cached when no texture/emissive). */
export function mat(color: THREE.ColorRepresentation, opts: MatOpts = {}) {
  const cacheable = !opts.map && !opts.emissive && !opts.transparent && opts.side === undefined;
  const key = `${new THREE.Color(color).getHexString()}|${opts.flat ?? true}|${opts.roughness ?? 0.9}|${opts.metalness ?? 0}`;
  if (cacheable) {
    const c = matCache.get(key);
    if (c) return c;
  }
  const params: THREE.MeshStandardMaterialParameters = {
    color,
    flatShading: opts.flat ?? true,
    roughness: opts.roughness ?? 0.9,
    metalness: opts.metalness ?? 0,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  };
  if (opts.map) params.map = opts.map;
  const m = new THREE.MeshStandardMaterial(params);
  if (cacheable) matCache.set(key, m);
  return m;
}

export function shadow(m: THREE.Mesh, cast = true, receive = true) {
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export function box(w: number, h: number, d: number, color: THREE.ColorRepresentation, opts?: MatOpts) {
  return shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts)));
}

export function cyl(rt: number, rb: number, h: number, seg: number, color: THREE.ColorRepresentation, opts?: MatOpts) {
  return shadow(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, opts)));
}

export function cone(r: number, h: number, seg: number, color: THREE.ColorRepresentation, opts?: MatOpts) {
  return shadow(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color, opts)));
}

export function sphere(r: number, color: THREE.ColorRepresentation, seg = 10, opts?: MatOpts) {
  return shadow(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(4, Math.floor(seg * 0.7))), mat(color, opts)));
}

export function plane(w: number, h: number, color: THREE.ColorRepresentation, opts?: MatOpts) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(color, { side: THREE.DoubleSide, ...opts }));
  m.receiveShadow = true;
  return m;
}

export function lathe(points: [number, number][], seg: number, color: THREE.ColorRepresentation, opts?: MatOpts) {
  const pts = points.map(([x, y]) => new THREE.Vector2(x, y));
  return shadow(new THREE.Mesh(new THREE.LatheGeometry(pts, seg), mat(color, opts)));
}

export function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry = 0) {
  o.position.set(x, y, z);
  if (ry) o.rotation.y = ry;
  return o;
}

export function group(...children: THREE.Object3D[]) {
  const g = new THREE.Group();
  g.add(...children);
  return g;
}

/** A gable roof: two slabs meeting at a ridge along the x axis. */
export function gableRoof(width: number, depth: number, height: number, color: THREE.ColorRepresentation, texture?: THREE.Texture, overhang = 0.35) {
  const g = new THREE.Group();
  const half = depth / 2 + overhang;
  const slope = Math.hypot(half, height);
  const angle = Math.atan2(height, half);
  const m = mat(color, { map: texture, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(width + overhang * 2, 0.06, slope), m);
    slab.castShadow = true;
    slab.receiveShadow = true;
    slab.position.set(0, height / 2, (s * half) / 2);
    slab.rotation.x = -s * angle;
    g.add(slab);
  }
  return g;
}

/** Stilts under a platform. */
export function stilts(width: number, depth: number, height: number, count: number, color: THREE.ColorRepresentation, radius = 0.09) {
  const g = new THREE.Group();
  const nx = Math.max(2, Math.round(count));
  const nz = 2 + (depth > 4 ? 1 : 0);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const p = cyl(radius, radius * 1.1, height, 6, color);
      p.position.set(-width / 2 + (i / (nx - 1)) * width, height / 2, -depth / 2 + (j / (nz - 1)) * depth);
      g.add(p);
    }
  return g;
}

export function flameSprite(size = 0.18) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: flameTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }),
  );
  s.scale.set(size * 0.66, size, 1);
  s.renderOrder = 10;
  return s;
}

export function glowSprite(color: THREE.ColorRepresentation, size = 0.6, opacity = 0.5) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: softCircleTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity }),
  );
  s.scale.set(size, size, 1);
  s.renderOrder = 9;
  return s;
}

/** A hanging cloth (sarong, batik, pua kumbu) on a line. */
export function cloth(w: number, h: number, texture: THREE.Texture, color: THREE.ColorRepresentation = 0xffffff) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 6, 1), mat(color, { map: texture, side: THREE.DoubleSide, flat: false }));
  m.castShadow = true;
  m.receiveShadow = true;
  m.position.y = -h / 2;
  return m;
}

/** Tiny "someone was here" details. */
export function slippers(color: THREE.ColorRepresentation = 0x3a6ab0) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const sole = box(0.1, 0.02, 0.26, color);
    sole.position.set(s * 0.07, 0.01, 0);
    const strap = box(0.1, 0.015, 0.03, 0xf0e6d6);
    strap.position.set(s * 0.07, 0.035, -0.05);
    g.add(sole, strap);
  }
  return g;
}

export function cup(color: THREE.ColorRepresentation = 0xf6efe2, r = 0.04, h = 0.06) {
  const g = new THREE.Group();
  const body = cyl(r, r * 0.85, h, 12, color);
  body.position.y = h / 2;
  const coffee = cyl(r * 0.9, r * 0.9, 0.005, 12, 0x3a2416);
  coffee.position.y = h - 0.004;
  g.add(body, coffee);
  return g;
}

/** Convert a hex/colour to a slightly darker variant. */
export function darker(color: THREE.ColorRepresentation, amount = 0.25) {
  const c = new THREE.Color(color);
  return c.multiplyScalar(1 - amount);
}

export function lighter(color: THREE.ColorRepresentation, amount = 0.25) {
  const c = new THREE.Color(color);
  return c.lerp(new THREE.Color(0xffffff), amount);
}
