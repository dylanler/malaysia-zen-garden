import * as THREE from 'three';
import { clamp, damp } from './util';
import type { Input } from './Input';
import type { Path } from '../world/Path';
import { type Terrain, WATER_Y } from '../world/Terrain';
import { JETTY_DECK_Y } from '../world/Path';
import { LAKE_RADIUS } from '../content/stations';
import type { LocomotionMode } from './Save';

export type Surface = 'land' | 'jetty' | 'water';

const EYE = 1.62;
const EYE_BOAT = 1.02;

export class Locomotion {
  mode: LocomotionMode = 'stroll';
  u = 0;
  /** Feet position on the ground/deck/boat. */
  position = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  autoWalk = false;
  autoTarget: number | null = null;
  /** True while a station has taken over the camera (hands view, sitting). */
  locked = false;
  seat: { eye: THREE.Vector3 } | null = null;
  surface: Surface = 'land';
  /** 0..1 how much we are walking right now (for bob and footsteps). */
  walking = 0;
  reducedMotion = false;
  /** Called on each footfall. */
  onStep: ((surface: Surface) => void) | null = null;
  /** Called when the auto-walk reaches its stop. */
  onArrive: (() => void) | null = null;
  lookSensitivity = 0.0034;
  /** Camera zoom factor (1 = normal); look sensitivity scales down with it. */
  zoom = 1;
  private eyeY = 0;
  private bobPhase = 0;
  private lastStepPhase = 0;
  private tangent = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private forwardXZ = new THREE.Vector2();
  private targetYaw: number | null = null;
  private targetPitch: number | null = null;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private path: Path,
    private terrain: Terrain,
    private input: Input,
  ) {
    camera.rotation.order = 'YXZ';
    this.teleport(0);
    this.eyeY = this.position.y + EYE;
    this.faceAlongPath();
  }

  teleport(u: number) {
    this.u = ((u % 1) + 1) % 1;
    this.path.getPoint(this.u, this.position);
    this.surface = this.path.surfaceAt(this.u);
    this.position.y = this.groundY(this.position.x, this.position.z, this.surface);
    this.eyeY = this.position.y + (this.surface === 'water' ? EYE_BOAT : EYE);
    this.autoWalk = false;
    this.autoTarget = null;
    // only the path knows the jetty and the sampan; free roam resumes ashore
    if (this.surface !== 'land') this.mode = 'stroll';
  }

  faceAlongPath() {
    this.path.getTangent(this.u, this.tangent);
    this.yaw = Math.atan2(-this.tangent.x, -this.tangent.z);
    this.pitch = -0.05;
  }

  /** Face a world point immediately (before the first frame has placed the camera). */
  faceToward(point: THREE.Vector3) {
    const dx = point.x - this.position.x;
    const dz = point.z - this.position.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = -0.02;
    this.targetYaw = null;
    this.targetPitch = null;
  }

  /** Smoothly turn to face a world point (used when sitting down / arriving). */
  lookAt(point: THREE.Vector3, from: THREE.Vector3 = this.camera.position) {
    const dx = point.x - from.x;
    const dy = point.y - from.y;
    const dz = point.z - from.z;
    this.targetYaw = Math.atan2(-dx, -dz);
    this.targetPitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -1.25, 1.35);
  }

  setMode(mode: LocomotionMode) {
    if (mode === this.mode) return;
    if (mode === 'stroll') {
      this.u = this.path.nearestU(this.position.x, this.position.z);
      this.path.getPoint(this.u, this.position);
      this.surface = this.path.surfaceAt(this.u);
      this.position.y = this.groundY(this.position.x, this.position.z, this.surface);
    }
    this.mode = mode;
    this.autoWalk = false;
    this.autoTarget = null;
  }

  private groundY(x: number, z: number, surface: Surface) {
    if (surface === 'water') return WATER_Y;
    if (surface === 'jetty') return JETTY_DECK_Y;
    return this.terrain.height(x, z);
  }

  /** Begin auto-walking to the next stop along the path. */
  autoWalkToNext() {
    const stop = this.path.nextStop(this.u);
    this.autoTarget = stop.u;
    this.autoWalk = true;
  }

  stopAuto() {
    this.autoWalk = false;
    this.autoTarget = null;
  }

  sit(eye: THREE.Vector3, lookAt?: THREE.Vector3) {
    this.seat = { eye: eye.clone() };
    this.locked = true;
    this.stopAuto();
    if (lookAt) this.lookAt(lookAt, eye);
  }

  stand() {
    this.seat = null;
    this.locked = false;
    // stop easing toward the seat's outlook once you are up
    this.targetYaw = null;
    this.targetPitch = null;
  }

  get onWater() {
    return this.surface === 'water';
  }

  update(dt: number) {
    const input = this.input;
    // look
    const look = input.consumeLook();
    if (!this.locked || this.seat) {
      const sens = (this.lookSensitivity * (input.isTouch ? 1.15 : input.locked ? 0.72 : 1)) / this.zoom;
      this.yaw -= look.dx * sens;
      this.pitch -= look.dy * sens;
      this.pitch = clamp(this.pitch, -1.25, 1.35);
      if (Math.abs(look.dx) > 0.5) this.targetYaw = null;
      if (Math.abs(look.dy) > 0.5) this.targetPitch = null;
    }
    if (this.targetYaw !== null) {
      let d = this.targetYaw - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 3);
      if (Math.abs(d) < 0.01) this.targetYaw = null;
    }
    if (this.targetPitch !== null) {
      const d = this.targetPitch - this.pitch;
      this.pitch += d * Math.min(1, dt * 3);
      if (Math.abs(d) < 0.01) this.targetPitch = null;
    }

    let moving = 0;
    if (!this.locked) {
      if (this.mode === 'stroll') moving = this.updateStroll(dt);
      else moving = this.updateFree(dt);
    }
    this.walking = damp(this.walking, moving, 8, dt);

    // eye height
    const targetEye = this.position.y + (this.surface === 'water' ? EYE_BOAT : EYE);
    this.eyeY = damp(this.eyeY, targetEye, 6, dt);

    // bob and footsteps
    let bob = 0;
    if (this.walking > 0.05 && this.surface !== 'water') {
      this.bobPhase += dt * 1.75 * Math.PI * 2 * this.walking;
      if (!this.reducedMotion) bob = Math.sin(this.bobPhase) * 0.028 * this.walking;
      const stepIdx = Math.floor(this.bobPhase / Math.PI);
      if (stepIdx !== this.lastStepPhase) {
        this.lastStepPhase = stepIdx;
        this.onStep?.(this.surface);
      }
    }
    if (this.surface === 'water' && !this.reducedMotion) bob = Math.sin(performance.now() * 0.0012) * 0.03;

    if (this.seat) {
      this.camera.position.copy(this.seat.eye);
    } else {
      this.camera.position.set(this.position.x, this.eyeY + bob, this.position.z);
    }
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  private updateStroll(dt: number): number {
    const input = this.input;
    if (input.consumeAutoWalkToggle()) {
      if (this.autoWalk) this.stopAuto();
      else this.autoWalkToNext();
    }
    let dir = 0;
    if (this.autoWalk) dir = 1;
    else if (input.walkHeld) {
      this.path.getTangent(this.u, this.tangent);
      this.forwardXZ.set(-Math.sin(this.yaw), -Math.cos(this.yaw));
      const dot = this.forwardXZ.x * this.tangent.x + this.forwardXZ.y * this.tangent.z;
      dir = dot >= -0.25 || this.surface === 'water' ? 1 : -1;
    } else if (input.moveY < -0.3 || input.moveY > 0.3) {
      dir = input.moveY < 0 ? 1 : -1;
    }
    if (dir === 0) return 0;
    return this.followPath(dt, dir);
  }

  /** Advance along the path; shared by strolling and by auto-walk in either mode. */
  private followPath(dt: number, dir: number): number {
    const speed = this.surface === 'water' ? 1.35 : 1.9;
    const du = (speed * dt) / this.path.length;
    const prev = this.u;
    let next = this.u + du * dir;
    if (this.autoWalk && this.autoTarget !== null) {
      // distance still to travel forward around the loop; robust across the u = 1 → 0 seam
      const ahead = (((this.autoTarget - prev) % 1) + 1) % 1;
      if (ahead <= du) {
        next = this.autoTarget;
        this.stopAuto();
        this.onArrive?.();
      }
    }
    this.u = ((next % 1) + 1) % 1;
    this.path.getPoint(this.u, this.tmp);
    this.surface = this.path.surfaceAt(this.u);
    this.position.set(this.tmp.x, this.groundY(this.tmp.x, this.tmp.z, this.surface), this.tmp.z);
    return this.surface === 'water' ? 0 : 1;
  }

  private updateFree(dt: number): number {
    const input = this.input;
    const mx = input.moveX;
    const my = input.moveY;
    const len = Math.hypot(mx, my);
    if (input.consumeAutoWalkToggle()) {
      if (this.autoWalk) this.stopAuto();
      else this.autoWalkToNext();
    }
    if (this.autoWalk) {
      // any step of your own takes over from the auto-walk
      if (len > 0.3) this.stopAuto();
      else return this.autoWalkFree(dt);
    }
    if (len < 0.05) return 0;
    const speed = 2.55 * Math.min(1, len);
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    const vx = (fx * -my + rx * mx) / len;
    const vz = (fz * -my + rz * mx) / len;
    let x = this.position.x + vx * speed * dt;
    let z = this.position.z + vz * speed * dt;
    // stay on the land ring
    const r = Math.hypot(x, z);
    const minR = LAKE_RADIUS + 4.4;
    const maxR = 71;
    if (r < minR) {
      x = (x / r) * minR;
      z = (z / r) * minR;
    } else if (r > maxR) {
      x = (x / r) * maxR;
      z = (z / r) * maxR;
    }
    this.surface = 'land';
    this.position.set(x, this.terrain.height(x, z), z);
    this.u = this.path.nearestU(x, z);
    return Math.min(1, len);
  }

  /** Auto-walk while free roaming: first rejoin the path at the nearest point, then follow it. */
  private autoWalkFree(dt: number): number {
    this.path.getPoint(this.u, this.tmp);
    const dx = this.tmp.x - this.position.x;
    const dz = this.tmp.z - this.position.z;
    const d = Math.hypot(dx, dz);
    const step = 2.2 * dt;
    if (d > step + 0.05) {
      const x = this.position.x + (dx / d) * step;
      const z = this.position.z + (dz / d) * step;
      this.surface = 'land';
      this.position.set(x, this.terrain.height(x, z), z);
      return 1;
    }
    return this.followPath(dt, 1);
  }

  /** World position of the "hands" (for fireflies, lanterns). */
  handPosition(out: THREE.Vector3) {
    out.set(0, -0.28, -0.6).applyEuler(this.camera.rotation).add(this.camera.position);
    return out;
  }

  static surfaceOf(x: number, z: number): Surface {
    const r = Math.hypot(x, z);
    if (r < LAKE_RADIUS - 0.6) return 'water';
    if (r < LAKE_RADIUS + 3.6) return 'jetty';
    return 'land';
  }
}
