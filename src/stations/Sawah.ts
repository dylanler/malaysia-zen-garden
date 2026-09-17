import * as THREE from 'three';
import { Station } from './Station';
import { box, cyl, cone, sphere, mat, shadow, gableRoof, stilts, plane } from '../world/props';
import { plankTexture, weaveTexture, leafTexture } from '../world/textures';
import { Drone } from '../audio/Synth';
import { Unwrap, type UnwrapStage } from '../systems/Unwrap';
import type { Interactable } from '../core/Interaction';

export class Sawah extends Station {
  private gongs: { mesh: THREE.Group; swing: number; note: number; big: boolean }[] = [];
  private strikes = 0;
  private sompoton: Drone;
  private sompotonHeld = false;
  private sompotonTime = 0;
  private cans: THREE.Mesh[] = [];
  private canTimer = 3;
  private unwrap: Unwrap | null = null;
  private opened = false;
  private drum!: THREE.Group;
  private drumHit = 0;

  constructor(ctx: ConstructorParameters<typeof Station>[0], def: ConstructorParameters<typeof Station>[1]) {
    super(ctx, def);
    this.sompoton = new Drone(ctx.audio, 'sompoton', 'music');
  }

  build() {
    const g = this.group;
    const wood = plankTexture('#a87b50', '#6e4a2c');

    // ---------------- sulap: a small open field hut on stilts
    const hut = new THREE.Group();
    const floorY = 0.9;
    const floor = box(4.2, 0.1, 3.2, '#b08458', { map: wood });
    floor.position.y = floorY;
    hut.add(floor, stilts(3.8, 2.8, floorY, 3, '#5a3d26'));
    for (const [x, z] of [
      [-1.9, -1.4],
      [1.9, -1.4],
      [-1.9, 1.4],
      [1.9, 1.4],
    ]) {
      const post = cyl(0.06, 0.07, 2.2, 6, '#6e4a2c');
      post.position.set(x, floorY + 1.1, z);
      hut.add(post);
    }
    const roof = gableRoof(4.6, 3.6, 1.1, '#b89a5a', weaveTexture('#b89a5a', '#8a6f3a'), 0.4);
    roof.position.y = floorY + 2.2;
    hut.add(roof);
    // low back wall
    const backWall = box(4.2, 1.0, 0.08, '#c69a6a', { map: wood });
    backWall.position.set(0, floorY + 0.55, 1.4);
    hut.add(backWall);
    // steps down toward the path
    for (let i = 0; i < 3; i++) {
      const s = box(0.9, 0.06, 0.3, '#a87b50', { map: wood });
      s.position.set(1.4, (floorY * (i + 0.5)) / 3, -1.6 - (2 - i) * 0.3);
      hut.add(s);
    }
    hut.position.set(0, 0, 4.6);
    g.add(hut);

    // ---------------- gongs hanging from the beam
    const beam = box(3.6, 0.1, 0.1, '#6e4a2c');
    beam.position.set(-0.3, floorY + 1.9, 4.6 - 0.8);
    g.add(beam);
    const gongMat = mat('#b08a3a', { roughness: 0.45, metalness: 0.7, flat: false });
    const bossMat = mat('#8a6a2a', { roughness: 0.5, metalness: 0.7, flat: false });
    const sizes = [0.22, 0.2, 0.18, 0.16, 0.15, 0.13];
    const notes = [0, 1, 2, 3, 4, 5];
    sizes.forEach((r, i) => {
      const gg = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 0.07, 20), gongMat);
      body.rotation.x = Math.PI / 2;
      const boss = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 10, 8), bossMat);
      boss.position.z = -0.05;
      shadow(body);
      gg.add(body, boss);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 4), mat('#3a2a1a'));
      cord.position.y = r + 0.25;
      gg.add(cord);
      gg.position.set(-1.7 + i * 0.56, floorY + 1.9 - 0.5 - r, 4.6 - 0.8);
      g.add(gg);
      this.gongs.push({ mesh: gg, swing: 0, note: notes[i], big: false });
      this.add({
        id: `sawah-gong-${i}`,
        object: gg,
        gestures: ['tap'],
        hint: 'Tap to strike the gong',
        markerSize: 0.22,
        range: 8,
        onTap: () => this.strike(this.gongs[i]),
      });
    });
    // the big gong on its own frame
    const frame = new THREE.Group();
    for (const x of [-0.7, 0.7]) {
      const p = cyl(0.05, 0.05, 1.6, 6, '#6e4a2c');
      p.position.set(x, 0.8, 0);
      frame.add(p);
    }
    const top = box(1.5, 0.08, 0.08, '#6e4a2c');
    top.position.y = 1.6;
    frame.add(top);
    const bigG = new THREE.Group();
    const big = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.46, 0.1, 24), gongMat);
    big.rotation.x = Math.PI / 2;
    const bigBoss = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), bossMat);
    bigBoss.position.z = -0.08;
    shadow(big);
    bigG.add(big, bigBoss);
    bigG.position.y = 0.95;
    frame.add(bigG);
    frame.position.set(2.6, floorY + 0.05, 4.6 - 0.6);
    g.add(frame);
    this.gongs.push({ mesh: bigG, swing: 0, note: -5, big: true });
    this.add({
      id: 'sawah-gong-big',
      object: bigG,
      gestures: ['tap'],
      hint: 'Tap the big gong; the padi will answer',
      markerSize: 0.3,
      range: 9,
      onTap: () => this.strike(this.gongs[this.gongs.length - 1]),
    });
    // gandang drum
    this.drum = new THREE.Group();
    const shell = cyl(0.22, 0.2, 0.55, 12, '#8a5a3a');
    shell.position.y = 0.275;
    const skin = cyl(0.23, 0.23, 0.02, 12, '#e8d6b0');
    skin.position.y = 0.56;
    this.drum.add(shell, skin);
    this.drum.position.set(-2.5, floorY + 0.05, 4.6 - 0.9);
    g.add(this.drum);
    this.add({
      id: 'sawah-drum',
      object: this.drum,
      gestures: ['tap'],
      hint: 'Tap the gandang',
      markerSize: 0.22,
      range: 8,
      onTap: () => {
        this.ctx.synth.thump(0.8);
        this.drumHit = 1;
        this.strikes++;
        if (this.strikes >= 5) this.complete('gongs');
      },
    });

    // ---------------- sompoton on the back wall shelf
    const shelf = box(0.6, 0.04, 0.25, '#8a6a3a');
    shelf.position.set(-1.2, floorY + 1.05, 4.6 + 1.25);
    g.add(shelf);
    const somp = new THREE.Group();
    const gourd = sphere(0.09, '#c9a86a', 10);
    gourd.scale.set(1, 1.2, 1);
    gourd.position.y = 0.09;
    const neck = cyl(0.02, 0.03, 0.14, 6, '#c9a86a');
    neck.position.set(0.09, 0.14, 0);
    neck.rotation.z = -1.1;
    somp.add(gourd, neck);
    for (let i = 0; i < 7; i++) {
      const pipe = cyl(0.008, 0.008, 0.28 + i * 0.03, 5, '#d9c48a');
      pipe.position.set(-0.03 + (i % 4) * 0.02, 0.28 + i * 0.015, -0.03 + Math.floor(i / 4) * 0.03);
      somp.add(pipe);
    }
    somp.position.set(-1.2, floorY + 1.07, 4.6 + 1.25);
    g.add(somp);
    this.add({
      id: 'sawah-sompoton',
      object: somp,
      gestures: ['hold'],
      hint: 'Hold to play the sompoton',
      markerSize: 0.24,
      range: 8,
      onHoldStart: () => {
        this.sompotonHeld = true;
        this.sompotonTime = 0;
        this.sompoton.start([146.83, 220, 293.66], 0.16);
      },
      onHoldEnd: (ms) => {
        this.sompotonHeld = false;
        this.sompoton.stop(0.9);
        if (ms > 2200) this.memory('sompoton');
      },
    });

    // ---------------- wakid basket with linopot bundles
    const wakid = new THREE.Group();
    const basket = cyl(0.22, 0.16, 0.5, 8, '#b89a5a', { map: weaveTexture('#b89a5a', '#8a6f3a') });
    basket.position.y = 0.25;
    wakid.add(basket);
    const bundles = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const b = sphere(0.09, '#4a8a38', 8, { map: leafTexture(), flat: false });
      b.scale.set(1, 0.8, 1);
      b.position.set((i - 1) * 0.1, 0.52, (i % 2) * 0.06);
      bundles.add(b);
    }
    wakid.add(bundles);
    wakid.position.set(0.8, floorY + 0.05, 4.6 + 0.9);
    g.add(wakid);
    this.add({
      id: 'sawah-linopot',
      object: bundles,
      gestures: ['tap'],
      hint: 'Tap to take a linopot',
      markerSize: 0.26,
      range: 8,
      enabled: () => !this.ctx.hands.active,
      onTap: () => this.takeLinopot(),
    });

    // ---------------- the field: dykes, a scarecrow with tin cans, egrets
    const dykeMat = mat('#6a5a3a');
    for (let i = 0; i < 5; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 14), dykeMat);
      const x = -9 + i * 4.5;
      if (Math.abs(x) < 3) continue;
      d.position.set(x, this.groundAt(x, -8) + 0.05, -8);
      g.add(d);
    }
    const scare = new THREE.Group();
    const pole = cyl(0.04, 0.05, 1.9, 6, '#8a6a3a');
    pole.position.y = 0.95;
    const arms = cyl(0.03, 0.03, 1.3, 6, '#8a6a3a');
    arms.rotation.z = Math.PI / 2;
    arms.position.y = 1.45;
    const shirt = box(0.55, 0.6, 0.2, '#c9553a');
    shirt.position.y = 1.25;
    const hat = cone(0.32, 0.22, 10, '#c9b07a');
    hat.position.y = 1.95;
    scare.add(pole, arms, shirt, hat);
    for (const x of [-0.7, 0.7]) {
      const string = cyl(0.004, 0.004, 0.35, 4, '#333333');
      string.position.set(x, 1.28, 0);
      const can = cyl(0.04, 0.04, 0.1, 8, '#b0b4b8', { metalness: 0.6, roughness: 0.4 });
      can.position.set(x, 1.05, 0);
      scare.add(string, can);
      this.cans.push(can);
    }
    this.settle(scare, -4.5, -6.5);
    scare.rotation.y = 0.4;
    g.add(scare);
    for (let i = 0; i < 3; i++) {
      const egret = new THREE.Group();
      const body = sphere(0.12, '#f6efe2', 8);
      body.scale.set(1, 0.8, 1.6);
      body.position.y = 0.42;
      const neck = cyl(0.025, 0.03, 0.3, 5, '#f6efe2');
      neck.position.set(0, 0.62, 0.15);
      neck.rotation.x = -0.3;
      const head = sphere(0.05, '#f6efe2', 6);
      head.position.set(0, 0.78, 0.2);
      const beak = cone(0.012, 0.12, 4, '#e8c840');
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.78, 0.31);
      const legs = cyl(0.008, 0.008, 0.4, 4, '#333333');
      legs.position.y = 0.2;
      egret.add(body, neck, head, beak, legs);
      this.settle(egret, 5 + i * 1.5, -9 + (i % 2) * 2);
      egret.rotation.y = Math.random() * Math.PI * 2;
      g.add(egret);
    }
    // a lookout plank at the field's edge to sit on
    const seatPlank = plane(1.2, 0.5, '#b08458', { map: wood });
    seatPlank.rotation.x = -Math.PI / 2;
    this.settle(seatPlank, -2.5, -2.4, 0.42);
    const seatLegs = box(1.0, 0.4, 0.3, '#6e4a2c');
    this.settle(seatLegs, -2.5, -2.4, 0.2);
    g.add(seatPlank, seatLegs);
    this.addSeat('field', seatPlank, new THREE.Vector3(-2.5, 1.35, -2.4), new THREE.Vector3(-2.5, 9, 60), 'Tap to sit and look at Kinabalu');
  }

  private strike(gg: { mesh: THREE.Group; swing: number; note: number; big: boolean }) {
    gg.swing = 1;
    this.strikes++;
    if (gg.big) {
      this.ctx.music.play('gongs', 0, 1);
      this.ctx.vegetation.pulse(1.2);
    } else {
      this.ctx.music.play('gongs', 5 + gg.note, 0.8);
    }
    if (this.strikes >= 5) this.complete('gongs');
  }

  private takeLinopot() {
    const root = new THREE.Group();
    const leafMat = mat('#4a8a38', { map: leafTexture(), side: THREE.DoubleSide, flat: false });
    // two leaf halves hinged at the bottom
    const halves: THREE.Object3D[] = [];
    const tips: THREE.Object3D[] = [];
    for (const s of [-1, 1]) {
      const hinge = new THREE.Object3D();
      hinge.position.set(0, 0.0, 0);
      const half = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8, s < 0 ? Math.PI : 0, Math.PI), leafMat);
      half.position.y = 0.06;
      half.scale.set(1, 0.9, 1);
      const tip = new THREE.Object3D();
      tip.position.set(s * 0.075, 0.12, 0);
      hinge.add(half, tip);
      root.add(hinge);
      halves.push(hinge);
      tips.push(tip);
    }
    // string tie
    const tie = new THREE.Group();
    const tieMesh = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.004, 6, 20), mat('#c9b07a'));
    const tieProxy = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.02, 6, 20), mat('#000000'));
    tieProxy.visible = false;
    tie.add(tieMesh, tieProxy);
    tie.position.y = 0.06;
    root.add(tie);
    // rice with a piece of dried fish and tapioca
    const food = new THREE.Group();
    const rice = sphere(0.055, '#f6efe2', 10, { roughness: 0.8 });
    rice.position.y = 0.055;
    const fish = box(0.05, 0.012, 0.02, '#8a5a3a');
    fish.position.set(0.02, 0.1, 0.02);
    fish.rotation.y = 0.4;
    const ubi = cyl(0.014, 0.014, 0.04, 8, '#f2e2b0');
    ubi.rotation.z = Math.PI / 2;
    ubi.position.set(-0.025, 0.1, -0.01);
    food.add(rice, fish, ubi);
    food.visible = false;
    root.add(food);
    root.scale.setScalar(1.5);

    const synth = this.ctx.synth;
    const stages: UnwrapStage[] = [
      {
        kind: 'flick',
        target: tie,
        hint: 'Flick the tie loose',
        apply: (t) => {
          tie.position.y = 0.06 + t * 0.15;
          tie.position.x = t * 0.2;
          tie.rotation.x = t * 1.5;
          tie.visible = t < 1;
        },
        onComplete: () => synth.snap(),
      },
      {
        kind: 'drag',
        target: halves[1].children[0],
        hint: 'Drag the leaf open',
        apply: (t) => {
          halves[1].rotation.z = -t * 1.4;
          food.visible = t > 0.3;
        },
        hinge: () => root.getWorldPosition(new THREE.Vector3()),
        tip: () => tips[1].getWorldPosition(new THREE.Vector3()),
        onMove: () => synth.leaf(0.3),
      },
      {
        kind: 'drag',
        target: halves[0].children[0],
        hint: 'And the other half',
        apply: (t) => {
          halves[0].rotation.z = t * 1.4;
        },
        hinge: () => root.getWorldPosition(new THREE.Vector3()),
        tip: () => tips[0].getWorldPosition(new THREE.Vector3()),
        onMove: () => synth.leaf(0.3),
      },
    ];
    this.opened = false;
    this.unwrap = new Unwrap(this.ctx.camera, stages, {
      idPrefix: 'linopot',
      onComplete: () => {
        this.opened = true;
        synth.leaf(0.6);
        window.setTimeout(() => this.ctx.music.play('gongs', 7, 0.35), 300);
        window.setTimeout(() => this.memory('linopot'), 800);
      },
    });
    for (const it of this.unwrap.interactables) this.ctx.interaction.register(it);
    const done: Interactable = { id: 'linopot-done', object: root, gestures: [], hint: 'Swipe down, or tap \u2715, to set it down', enabled: () => this.opened };
    this.ctx.interaction.register(done);
    synth.leaf(0.5);
    this.ctx.hands.open(root, [...this.unwrap.interactables, done], {
      onClose: () => {
        for (const it of this.unwrap!.interactables) this.ctx.interaction.unregister(it);
        this.ctx.interaction.unregister(done);
        this.unwrap = null;
      },
    });
  }

  override exit() {
    super.exit();
    if (this.sompoton.playing) this.sompoton.stop(0.6);
  }

  override update(dt: number, time: number) {
    this.tickSeat(dt);
    this.unwrap?.update(dt);
    for (const gg of this.gongs) {
      if (gg.swing > 0.001) {
        gg.swing = Math.max(0, gg.swing - dt * 0.35);
        gg.mesh.rotation.x = Math.sin(time * 6) * 0.08 * gg.swing;
        gg.mesh.position.z += 0; // pivot handled by rotation only
      }
    }
    if (this.drumHit > 0) {
      this.drumHit = Math.max(0, this.drumHit - dt * 4);
      this.drum.scale.set(1 + this.drumHit * 0.04, 1 - this.drumHit * 0.05, 1 + this.drumHit * 0.04);
    }
    if (this.sompotonHeld) {
      this.sompotonTime += dt;
      this.sompoton.setFilter(900 + Math.sin(time * 0.8) * 250);
    }
    // tin cans clink in the wind now and then
    this.canTimer -= dt;
    if (this.canTimer <= 0) {
      this.canTimer = 4 + Math.random() * 9;
      if (this.active) this.ctx.synth.cowrie();
      for (const c of this.cans) c.userData.swing = 1;
    }
    for (const c of this.cans) {
      const s = (c.userData.swing as number | undefined) ?? 0;
      if (s > 0) {
        c.userData.swing = Math.max(0, s - dt * 0.8);
        c.position.z = Math.sin(time * 9) * 0.05 * s;
      }
    }
  }
}
