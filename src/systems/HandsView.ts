import * as THREE from 'three';
import type { Interaction, Interactable } from '../core/Interaction';
import type { Locomotion } from '../core/Locomotion';
import type { UI } from '../ui/UI';

/**
 * Brings an object "into your hands": parents it to the camera, dims the world, restricts
 * interaction to the object's own parts, and pauses walking until it is put down.
 */
export class HandsView {
  holder = new THREE.Group();
  active = false;
  private object: THREE.Object3D | null = null;
  private onClose: (() => void) | null = null;
  private t = 0;
  private closing = false;
  private basePos = new THREE.Vector3(0.12, -0.17, -0.46);
  private baseRot = new THREE.Euler(0.35, -0.35, 0.05);

  constructor(
    private camera: THREE.PerspectiveCamera,
    private interaction: Interaction,
    private locomotion: Locomotion,
    private ui: UI,
  ) {
    camera.add(this.holder);
    this.holder.position.copy(this.basePos);
    this.holder.rotation.copy(this.baseRot);
    this.holder.scale.setScalar(0.001);
    this.holder.visible = false;
    ui.onCloseFocus(() => this.close());
    interaction.onFocusSwipeDown = () => this.close();
  }

  open(object: THREE.Object3D, focus: Interactable[], opts: { position?: THREE.Vector3; rotation?: THREE.Euler; onClose?: () => void } = {}) {
    if (this.active) this.close(true);
    this.object = object;
    this.holder.add(object);
    this.holder.position.copy(opts.position ?? this.basePos);
    this.holder.rotation.copy(opts.rotation ?? this.baseRot);
    this.holder.visible = true;
    this.holder.scale.setScalar(0.001);
    this.t = 0;
    this.closing = false;
    this.active = true;
    this.onClose = opts.onClose ?? null;
    this.interaction.setFocusSet(focus);
    this.interaction.markersVisible = false;
    this.locomotion.locked = true;
    this.locomotion.stopAuto();
    this.ui.setFocusMode(true);
  }

  close(immediate = false) {
    if (!this.active) return;
    this.closing = true;
    this.interaction.setFocusSet(null);
    this.interaction.markersVisible = true;
    this.locomotion.locked = false;
    this.ui.setFocusMode(false);
    const cb = this.onClose;
    this.onClose = null;
    this.active = false;
    if (immediate) this.finishClose();
    cb?.();
  }

  private finishClose() {
    if (this.object) this.holder.remove(this.object);
    this.object = null;
    this.holder.visible = false;
    this.closing = false;
  }

  update(dt: number, time: number) {
    if (!this.holder.visible) return;
    if (this.closing) {
      this.t = Math.max(0, this.t - dt * 3.5);
      if (this.t <= 0) this.finishClose();
    } else {
      this.t = Math.min(1, this.t + dt * 2.2);
    }
    const e = this.t < 1 ? 1 - Math.pow(1 - this.t, 3) : 1;
    this.holder.scale.setScalar(Math.max(0.001, e));
    // a little breathing in the hands
    this.holder.position.y = this.basePos.y + Math.sin(time * 1.3) * 0.004;
    this.holder.rotation.z = this.baseRot.z + Math.sin(time * 0.9) * 0.01;
  }
}
