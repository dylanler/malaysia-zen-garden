import * as THREE from 'three';
import type { StationDef } from '../content/stations';
import type { Terrain } from '../world/Terrain';
import type { Path } from '../world/Path';
import type { Water } from '../world/Water';
import type { Vegetation } from '../world/Vegetation';
import type { TimeOfDay } from '../core/TimeOfDay';
import type { Weather } from '../core/Weather';
import type { Interaction, Interactable } from '../core/Interaction';
import type { Locomotion } from '../core/Locomotion';
import type { Input } from '../core/Input';
import type { AudioEngine } from '../audio/AudioEngine';
import type { Synth } from '../audio/Synth';
import type { Music } from '../audio/Music';
import type { Ambience } from '../audio/Ambience';
import type { UI } from '../ui/UI';
import type { Save } from '../core/Save';
import type { Ripples, Fireflies } from '../world/Particles';
import type { HandsView } from '../systems/HandsView';
import { degToRad } from '../core/util';

export interface Quality {
  shadows: boolean;
  mobile: boolean;
  low: boolean;
}

export interface StationContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  terrain: Terrain;
  path: Path;
  water: Water;
  vegetation: Vegetation;
  time: TimeOfDay;
  weather: Weather;
  interaction: Interaction;
  locomotion: Locomotion;
  input: Input;
  audio: AudioEngine;
  synth: Synth;
  music: Music;
  ambience: Ambience;
  ui: UI;
  save: Save;
  ripples: Ripples;
  fireflies: Fireflies;
  hands: HandsView;
  quality: Quality;
  /** Container for particle systems and other world-space effects. */
  effects: THREE.Group;
  /** Begin a new day once the pelita are lit. */
  newLoop: () => void;
}

export abstract class Station {
  group = new THREE.Group();
  center = new THREE.Vector3();
  angle: number;
  interactables: Interactable[] = [];
  completed = false;
  visited = false;
  active = false;
  triggerRadius = 13;
  private shownMemories = new Set<string>();

  constructor(
    protected ctx: StationContext,
    readonly def: StationDef,
  ) {
    this.angle = degToRad(def.angle);
    const x = Math.sin(this.angle) * def.radius;
    const z = Math.cos(this.angle) * def.radius;
    const pad = ctx.terrain.pads.find((p) => p.id === def.id);
    const y = pad ? pad.h : ctx.terrain.height(x, z);
    this.center.set(x, y, z);
    this.group.position.copy(this.center);
    this.group.rotation.y = this.angle;
    this.group.name = `station-${def.id}`;
    ctx.scene.add(this.group);
  }

  abstract build(): void;

  /** < 1 means the player is inside this station; the smallest score wins. */
  score(pos: THREE.Vector3) {
    const dx = pos.x - this.center.x;
    const dz = pos.z - this.center.z;
    return Math.hypot(dx, dz) / this.triggerRadius;
  }

  /** Restore persisted state (e.g. a lit lantern) after a reload. */
  restore?(): void;

  /** Hour to tween to when the player arrives. */
  targetHour() {
    return this.def.hour;
  }

  enter() {
    this.active = true;
  }

  exit() {
    this.active = false;
    this.stand();
  }

  update(_dt: number, _time: number) {}

  /** Reset for a new loop of the day. */
  reset() {
    this.completed = false;
    this.shownMemories.clear();
  }

  protected add(it: Interactable) {
    this.ctx.interaction.register(it);
    this.interactables.push(it);
    return it;
  }

  protected remove(it: Interactable) {
    this.ctx.interaction.unregister(it);
    this.interactables = this.interactables.filter((i) => i !== it);
  }

  protected local(x: number, y: number, z: number) {
    return this.group.localToWorld(new THREE.Vector3(x, y, z));
  }

  protected groundAt(x: number, z: number) {
    const w = this.local(x, 0, z);
    return this.ctx.terrain.height(w.x, w.z) - this.center.y;
  }

  protected distanceToPlayer() {
    return this.ctx.camera.position.distanceTo(this.center);
  }

  protected memory(key: string) {
    if (this.shownMemories.has(key)) return;
    this.shownMemories.add(key);
    const text = this.def.memories[key];
    if (text) this.ctx.ui.showMemory(text);
  }

  protected complete(memoryKey?: string) {
    if (memoryKey) this.memory(memoryKey);
    if (this.completed) return;
    this.completed = true;
    this.ctx.save.markCompleted(this.def.id);
    this.ctx.ui.setProgress(this.ctx.save.progress.visited, this.ctx.save.progress.completed, this.def.id);
    window.setTimeout(() => {
      if (this.active) this.ctx.ui.showAfterword(this.def.afterword);
    }, 7000);
  }

  /** Attach a mesh to the terrain surface at a local xz position. */
  protected settle<T extends THREE.Object3D>(o: T, x: number, z: number, lift = 0) {
    o.position.set(x, this.groundAt(x, z) + lift, z);
    return o;
  }

  // ---------------------------------------------------------------- sitting

  protected seatedId: string | null = null;
  protected sitTime = 0;

  /** Register a place to sit. eye/lookAt are in the station's local space. */
  protected addSeat(id: string, object: THREE.Object3D, eye: THREE.Vector3, lookAt: THREE.Vector3 | null, hint = 'Tap to sit for a while', onSit?: () => void) {
    return this.add({
      id: `${this.def.id}-seat-${id}`,
      object,
      gestures: ['tap'],
      hint,
      range: 6,
      markerSize: 0.3,
      enabled: () => this.seatedId === null && !this.ctx.hands.active,
      onTap: () => {
        this.seatedId = id;
        this.sitTime = 0;
        const eyeW = this.group.localToWorld(eye.clone());
        const lookW = lookAt ? this.group.localToWorld(lookAt.clone()) : undefined;
        this.ctx.locomotion.sit(eyeW, lookW);
        this.ctx.ambience.focus = 1;
        this.ctx.ui.hideStationCard();
        onSit?.();
      },
    });
  }

  onEmptyTap() {
    if (this.seatedId) this.stand();
  }

  protected stand() {
    if (!this.seatedId) return;
    this.seatedId = null;
    this.ctx.locomotion.stand();
    this.ctx.ambience.focus = 0;
  }

  protected tickSeat(dt: number) {
    if (this.seatedId) this.sitTime += dt;
  }
}
