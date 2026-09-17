import * as THREE from 'three';
import type { Interactable } from '../core/Interaction';

export interface UnwrapStage {
  kind: 'flick' | 'drag';
  target: THREE.Object3D;
  hint: string;
  /** Apply progress 0..1 to the geometry. */
  apply: (t: number) => void;
  /** World-space hinge and tip, used to make the drag direction feel right. */
  hinge?: () => THREE.Vector3;
  tip?: () => THREE.Vector3;
  onComplete?: () => void;
  onMove?: (delta: number) => void;
}

/** Generic peel/unfold controller: ordered stages, each scrubbed by a drag and snapped on release. */
export class Unwrap {
  stage = 0;
  progress = 0;
  done = false;
  interactables: Interactable[] = [];
  private snapTarget: number | null = null;
  private ndcA = new THREE.Vector3();
  private ndcB = new THREE.Vector3();
  private soundAcc = 0;

  constructor(
    private camera: THREE.Camera,
    private stages: UnwrapStage[],
    private opts: { onComplete?: () => void; idPrefix?: string } = {},
  ) {
    stages.forEach((s, i) => {
      const it: Interactable = {
        id: `${opts.idPrefix ?? 'unwrap'}-${i}`,
        object: s.target,
        gestures: s.kind === 'flick' ? ['flick', 'tap', 'drag'] : ['drag'],
        hint: s.hint,
        enabled: () => this.stage === i && !this.done,
        onTap: () => {
          if (s.kind === 'flick') this.finishStage();
        },
        onFlick: () => this.finishStage(),
        onDragStart: () => {
          this.snapTarget = null;
        },
        onDrag: (dx, dy) => this.drag(dx, dy),
        onDragEnd: () => {
          if (s.kind === 'flick') {
            if (this.progress > 0.3) this.finishStage();
            else this.snapTarget = 0;
            return;
          }
          this.snapTarget = this.progress > 0.42 ? 1 : 0;
        },
      };
      this.interactables.push(it);
    });
    for (const s of stages) s.apply(0);
  }

  private drag(dx: number, dy: number) {
    const s = this.stages[this.stage];
    if (!s || this.done) return;
    let along = Math.hypot(dx, dy);
    if (s.hinge && s.tip) {
      this.ndcA.copy(s.hinge()).project(this.camera);
      this.ndcB.copy(s.tip()).project(this.camera);
      const dirX = this.ndcB.x - this.ndcA.x;
      const dirY = this.ndcB.y - this.ndcA.y;
      const len = Math.hypot(dirX, dirY);
      if (len > 1e-4) {
        const dot = (dx * dirX + -dy * dirY) / len;
        along = Math.max(dot, 0.35 * Math.hypot(dx, dy));
      }
    }
    const delta = along / 0.2;
    this.progress = THREE.MathUtils.clamp(this.progress + delta, 0, 1);
    s.apply(this.progress);
    this.soundAcc += Math.abs(delta);
    if (this.soundAcc > 0.18) {
      this.soundAcc = 0;
      s.onMove?.(delta);
    }
    if (this.progress >= 1) this.finishStage();
  }

  private finishStage() {
    const s = this.stages[this.stage];
    if (!s || this.done) return;
    this.progress = 1;
    s.apply(1);
    s.onComplete?.();
    this.stage++;
    this.progress = 0;
    this.snapTarget = null;
    if (this.stage >= this.stages.length) {
      this.done = true;
      this.opts.onComplete?.();
    }
  }

  update(dt: number) {
    if (this.done || this.snapTarget === null) return;
    const s = this.stages[this.stage];
    if (!s) return;
    const dir = this.snapTarget - this.progress;
    const step = Math.sign(dir) * dt * 3.2;
    if (Math.abs(dir) <= Math.abs(step)) {
      this.progress = this.snapTarget;
      s.apply(this.progress);
      if (this.snapTarget === 1) this.finishStage();
      this.snapTarget = null;
      return;
    }
    this.progress += step;
    s.apply(this.progress);
  }

  get currentHint() {
    return this.stages[this.stage]?.hint ?? null;
  }
}
