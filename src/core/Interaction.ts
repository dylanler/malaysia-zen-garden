import * as THREE from 'three';
import type { PointerHandler } from './Input';
import { ringTexture } from '../world/textures';

export type GestureKind = 'tap' | 'hold' | 'drag' | 'flick';

export interface Interactable {
  id: string;
  object: THREE.Object3D;
  gestures: GestureKind[];
  hint: string | (() => string);
  range?: number;
  markerOffset?: THREE.Vector3;
  markerSize?: number;
  enabled?: () => boolean;
  onTap?: (hit: THREE.Intersection) => void;
  onHoldStart?: (hit: THREE.Intersection) => void;
  onHoldEnd?: (durationMs: number) => void;
  onDragStart?: (hit: THREE.Intersection) => void;
  /** dx, dy in screen-fraction units (pixels / min(width, height)); ndc is the current pointer position. */
  onDrag?: (dx: number, dy: number, ndc: THREE.Vector2) => void;
  onDragEnd?: (vx: number, vy: number) => void;
  onFlick?: (vx: number, vy: number) => void;
}

export interface GlobalHold {
  hint: string;
  onStart: () => void;
  onEnd: (durationMs: number) => void;
}

interface Registered {
  it: Interactable;
  marker: THREE.Sprite;
  center: THREE.Vector3;
  eligible: boolean;
  distance: number;
  screenDist: number;
}

interface GestureState {
  reg: Registered | null; // null => global hold / focus swipe
  hit: THREE.Intersection | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
  moved: boolean;
  holding: boolean;
  dragging: boolean;
  holdTimer: number | null;
  vx: number;
  vy: number;
  lastMoveTime: number;
  sumDX: number;
  sumDY: number;
}

const HOLD_MS = 340;
const MOVE_PX = 7;
const FLICK_SPEED = 1.1; // screen fractions per second

export class Interaction implements PointerHandler {
  readonly markers = new THREE.Group();
  focused: Interactable | null = null;
  hovered: Interactable | null = null;
  globalHold: GlobalHold | null = null;
  onEmptyTapCallback: (() => void) | null = null;
  onFocusSwipeDown: (() => void) | null = null;
  markersVisible = true;

  private regs: Registered[] = [];
  private byObject = new Map<THREE.Object3D, Registered>();
  private focusSet: Set<Interactable> | null = null;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private gesture: GestureState | null = null;
  private time = 0;
  private markerMaterial: THREE.SpriteMaterial;
  private tmp = new THREE.Vector3();
  private box = new THREE.Box3();

  constructor(private camera: THREE.PerspectiveCamera) {
    this.markerMaterial = new THREE.SpriteMaterial({
      map: ringTexture(),
      transparent: true,
      depthTest: false,
      depthWrite: false,
      color: 0xf6efe2,
      opacity: 0.8,
    });
    this.markers.renderOrder = 999;
    this.raycaster.far = 40;
  }

  register(it: Interactable) {
    const marker = new THREE.Sprite(this.markerMaterial.clone());
    const s = it.markerSize ?? 0.34;
    marker.scale.set(s, s, 1);
    marker.renderOrder = 999;
    marker.userData.isMarker = true;
    this.markers.add(marker);
    const reg: Registered = { it, marker, center: new THREE.Vector3(), eligible: false, distance: 99, screenDist: 99 };
    this.regs.push(reg);
    this.byObject.set(it.object, reg);
    this.byObject.set(marker, reg);
    it.object.traverse((o) => {
      o.userData.interactableId = it.id;
    });
    return it;
  }

  unregister(it: Interactable) {
    const idx = this.regs.findIndex((r) => r.it === it);
    if (idx < 0) return;
    const reg = this.regs[idx];
    this.markers.remove(reg.marker);
    this.byObject.delete(it.object);
    this.byObject.delete(reg.marker);
    this.regs.splice(idx, 1);
    if (this.focused === it) this.focused = null;
    if (this.hovered === it) this.hovered = null;
  }

  /** Restrict interaction to a set (hands view). Pass null to restore. */
  setFocusSet(set: Interactable[] | null) {
    this.focusSet = set ? new Set(set) : null;
    this.hovered = null;
    this.focused = null;
  }

  get inFocus() {
    return this.focusSet !== null;
  }

  private findReg(obj: THREE.Object3D | null): Registered | null {
    let o: THREE.Object3D | null = obj;
    while (o) {
      const r = this.byObject.get(o);
      if (r) return r;
      o = o.parent;
    }
    return null;
  }

  private hitTest(x: number, y: number): { reg: Registered; hit: THREE.Intersection } | null {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const targets: THREE.Object3D[] = [];
    for (const r of this.regs) {
      if (!r.eligible) continue;
      targets.push(r.it.object);
      if (!this.focusSet) targets.push(r.marker);
    }
    if (targets.length === 0) return null;
    const hits = this.raycaster.intersectObjects(targets, true);
    for (const hit of hits) {
      const reg = this.findReg(hit.object);
      if (reg && reg.eligible) return { reg, hit };
    }
    return null;
  }

  update(dt: number) {
    this.time += dt;
    const camPos = this.camera.position;
    const fwd = this.tmp.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    let best: Registered | null = null;
    let bestScore = Infinity;
    for (const r of this.regs) {
      const it = r.it;
      // marker position: bounding center + offset
      this.box.setFromObject(it.object);
      if (this.box.isEmpty()) it.object.getWorldPosition(r.center);
      else this.box.getCenter(r.center);
      if (it.markerOffset) r.center.add(it.markerOffset);
      r.distance = r.center.distanceTo(camPos);
      const enabled = it.enabled ? it.enabled() : true;
      if (this.focusSet) r.eligible = enabled && this.focusSet.has(it);
      else r.eligible = enabled && r.distance <= (it.range ?? 7);

      const m = r.marker;
      if (r.eligible && this.markersVisible && !this.focusSet) {
        m.visible = true;
        m.position.copy(r.center);
        const pulse = 0.85 + 0.15 * Math.sin(this.time * 2.2 + r.center.x * 0.5);
        const s = (it.markerSize ?? 0.34) * pulse;
        m.scale.set(s, s, 1);
        const mat = m.material as THREE.SpriteMaterial;
        const near = THREE.MathUtils.clamp(1 - (r.distance - 2) / 8, 0.35, 1);
        mat.opacity = (this.hovered === it || this.focused === it ? 0.95 : 0.5) * near;
        // angular distance from view center
        const dir = r.center.clone().sub(camPos).normalize();
        const cos = dir.dot(fwd);
        r.screenDist = Math.acos(THREE.MathUtils.clamp(cos, -1, 1));
        if (r.screenDist < 0.5) {
          const score = r.screenDist + r.distance * 0.03;
          if (score < bestScore) {
            bestScore = score;
            best = r;
          }
        }
      } else {
        m.visible = false;
        r.screenDist = 99;
      }
    }
    if (this.gesture?.reg) this.focused = this.gesture.reg.it;
    else if (this.hovered && this.regs.find((r) => r.it === this.hovered)?.eligible) this.focused = this.hovered;
    else if (this.focusSet) this.focused = null;
    else this.focused = best ? best.it : null;
  }

  hintText(): string | null {
    if (this.gesture?.holding && this.gesture.reg === null && this.globalHold) return this.globalHold.hint;
    if (this.focused) {
      const h = this.focused.hint;
      return typeof h === 'function' ? h() : h;
    }
    if (this.globalHold && !this.focusSet) return this.globalHold.hint;
    return null;
  }

  // ---------- PointerHandler ----------

  onPointerDown(x: number, y: number): boolean {
    const found = this.hitTest(x, y);
    const now = performance.now();
    const base: GestureState = {
      reg: null,
      hit: null,
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
      startTime: now,
      moved: false,
      holding: false,
      dragging: false,
      holdTimer: null,
      vx: 0,
      vy: 0,
      lastMoveTime: now,
      sumDX: 0,
      sumDY: 0,
    };
    if (found) {
      const g: GestureState = { ...base, reg: found.reg, hit: found.hit };
      this.gesture = g;
      if (found.reg.it.gestures.includes('hold')) {
        g.holdTimer = window.setTimeout(() => {
          if (this.gesture !== g || g.moved) return;
          g.holding = true;
          g.reg?.it.onHoldStart?.(g.hit!);
        }, HOLD_MS);
      }
      return true;
    }
    if (this.focusSet) {
      this.gesture = base; // focus swipe
      return true;
    }
    if (this.globalHold) {
      const g = base;
      this.gesture = g;
      g.holdTimer = window.setTimeout(() => {
        if (this.gesture !== g || g.moved) return;
        g.holding = true;
        this.globalHold?.onStart();
      }, HOLD_MS);
      return true;
    }
    return false;
  }

  onPointerMove(x: number, y: number, dx: number, dy: number): boolean {
    const g = this.gesture;
    if (!g) return true;
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    const now = performance.now();
    const dtMs = Math.max(1, now - g.lastMoveTime);
    g.lastMoveTime = now;
    g.lastX = x;
    g.lastY = y;
    const fdx = dx / minDim;
    const fdy = dy / minDim;
    // velocity estimate (screen fractions per second), smoothed
    const ivx = (fdx * 1000) / dtMs;
    const ivy = (fdy * 1000) / dtMs;
    g.vx = g.vx * 0.5 + ivx * 0.5;
    g.vy = g.vy * 0.5 + ivy * 0.5;
    g.sumDX += fdx;
    g.sumDY += fdy;

    const dist = Math.hypot(x - g.startX, y - g.startY);
    if (!g.moved && dist > MOVE_PX) {
      g.moved = true;
      if (g.holdTimer !== null && !g.holding) {
        clearTimeout(g.holdTimer);
        g.holdTimer = null;
      }
      if (g.reg) {
        const it = g.reg.it;
        if (it.gestures.includes('drag')) {
          g.dragging = true;
          it.onDragStart?.(g.hit!);
        } else if (!g.holding && !it.gestures.includes('flick')) {
          // not a drag interactable: release to camera look
          this.gesture = null;
          return true;
        }
      } else if (!this.focusSet && !g.holding) {
        this.gesture = null;
        return true;
      }
    }
    if (g.dragging && g.reg) {
      this.ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
      g.reg.it.onDrag?.(fdx, fdy, this.ndc);
    }
    return false;
  }

  onPointerUp(x: number, y: number, durationMs: number) {
    const g = this.gesture;
    this.gesture = null;
    if (!g) return;
    if (g.holdTimer !== null) clearTimeout(g.holdTimer);
    if (g.reg) {
      const it = g.reg.it;
      if (g.holding) {
        it.onHoldEnd?.(durationMs);
        return;
      }
      if (g.dragging) {
        const speed = Math.hypot(g.vx, g.vy);
        if (it.gestures.includes('flick') && speed > FLICK_SPEED) it.onFlick?.(g.vx, g.vy);
        else it.onDragEnd?.(g.vx, g.vy);
        return;
      }
      if (g.moved && it.gestures.includes('flick')) {
        const speed = Math.hypot(g.vx, g.vy);
        if (speed > FLICK_SPEED * 0.6) it.onFlick?.(g.vx, g.vy);
        return;
      }
      if (!g.moved && durationMs < 500 && it.gestures.includes('tap')) it.onTap?.(g.hit!);
      else if (!g.moved && it.gestures.includes('tap') && !it.gestures.includes('hold')) it.onTap?.(g.hit!);
      return;
    }
    // no interactable
    if (this.focusSet) {
      if (g.sumDY > 0.16) this.onFocusSwipeDown?.();
      return;
    }
    if (g.holding) this.globalHold?.onEnd(durationMs);
    else if (!g.moved) this.onEmptyTapCallback?.();
    void x;
    void y;
  }

  onEmptyTap() {
    this.onEmptyTapCallback?.();
  }

  onHover(x: number, y: number) {
    if (x < 0) {
      this.hovered = null;
      return;
    }
    const found = this.hitTest(x, y);
    this.hovered = found ? found.reg.it : null;
  }

  cancel() {
    const g = this.gesture;
    if (!g) return;
    if (g.holdTimer !== null) clearTimeout(g.holdTimer);
    if (g.holding) {
      if (g.reg) g.reg.it.onHoldEnd?.(performance.now() - g.startTime);
      else this.globalHold?.onEnd(performance.now() - g.startTime);
    }
    this.gesture = null;
  }
}

export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}
