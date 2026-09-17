import * as THREE from 'three';
import { Station } from './Station';
import { box, cyl, mat, shadow, gableRoof, stilts, cloth, lathe, slippers } from '../world/props';
import { plankTexture, puaTexture, weaveTexture, lapisTexture, zincTexture } from '../world/textures';

export class RumahPanjai extends Station {
  private rows = 0;
  private woven!: THREE.Mesh;
  private warp!: THREE.Mesh;
  private shuttle!: THREE.Mesh;
  private shuttleT = 0;
  private shuttleDir = 1;
  private shuttleMoving = false;
  private dragAcc = 0;
  private lapisSlices: THREE.Mesh[] = [];
  private sliceIndex = 0;
  private floorY = 2.5;
  private gongs: { mesh: THREE.Mesh; swing: number }[] = [];

  build() {
    const g = this.group;
    const wood = plankTexture('#a87b50', '#6e4a2c');
    const dark = plankTexture('#6e4a2c', '#3f2a18');
    const floorY = this.floorY;
    // the house stands back from the path; its open ruai faces the walker and the lake
    const HZ = 8;

    // ---------------- the longhouse: long, high, open ruai toward the path
    const house = new THREE.Group();
    const length = 20;
    const depth = 7;
    const floor = box(length, 0.16, depth, '#b08458', { map: wood });
    floor.position.y = floorY;
    house.add(floor, stilts(length - 1, depth - 1, floorY, 9, '#4a3222', 0.12));
    // bilik (family rooms) wall along the back half
    const wallH = 2.6;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(length, wallH, 0.1), mat('#c69a6a', { map: wood }));
    wall.position.set(0, floorY + wallH / 2, 0.6);
    shadow(wall);
    house.add(wall);
    for (let i = 0; i < 5; i++) {
      const door = box(0.9, 1.9, 0.06, '#2a2a3a');
      door.position.set(-8 + i * 4, floorY + 1.0, 0.55);
      house.add(door);
      const frame = box(1.05, 0.08, 0.1, '#e8dcc4');
      frame.position.set(-8 + i * 4, floorY + 2.0, 0.55);
      house.add(frame);
    }
    const backWall = wall.clone();
    backWall.position.z = 3.5;
    house.add(backWall);
    for (const x of [-length / 2, length / 2]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.1, wallH, depth), mat('#c69a6a', { map: wood }));
      side.position.set(x, floorY + wallH / 2, 0);
      shadow(side);
      house.add(side);
    }
    // ruai posts along the open front
    for (let i = 0; i <= 5; i++) {
      const post = cyl(0.09, 0.1, wallH, 6, '#6e4a2c');
      post.position.set(-length / 2 + i * (length / 5), floorY + wallH / 2, -depth / 2 + 0.1);
      house.add(post);
    }
    const roof = gableRoof(length + 0.8, depth + 0.6, 2.6, '#8e9299', zincTexture(), 0.6);
    roof.position.y = floorY + wallH;
    house.add(roof);
    // notched log tangga up to the ruai
    const log = cyl(0.14, 0.16, Math.hypot(floorY, 2.2) + 0.2, 8, '#5a3d26');
    log.position.set(0.6, floorY / 2, -depth / 2 - 1.1);
    log.rotation.x = Math.atan2(2.2, floorY);
    house.add(log);
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const notch = box(0.3, 0.06, 0.16, '#3f2a18');
      notch.position.set(0.6, floorY * t, -depth / 2 - 2.2 + 2.2 * t);
      house.add(notch);
    }
    house.position.set(0, 0, HZ);
    g.add(house);
    this.addSeat('ruai', log, new THREE.Vector3(0.6, floorY + 1.55, HZ - depth / 2 + 1.4), new THREE.Vector3(-3, floorY + 1.3, HZ), 'Tap the tangga to climb onto the ruai', () => {
      this.ctx.ui.setHint(null);
    });

    // pua kumbu hanging from the beams
    const puaPositions = [-7.5, -3, 4.5, 8];
    puaPositions.forEach((x, i) => {
      const c = cloth(1.3, 1.9, puaTexture(9 + i));
      c.position.set(x, floorY + wallH - 0.1, HZ - depth / 2 + 0.6);
      c.rotation.y = 0;
      g.add(c);
    });
    // tuak jars along the wall, a tikar, slippers at the top of the tangga
    for (let i = 0; i < 4; i++) {
      const jar = lathe(
        [
          [0, 0],
          [0.18, 0],
          [0.26, 0.2],
          [0.24, 0.45],
          [0.14, 0.55],
          [0.15, 0.6],
        ],
        12,
        ['#5a3a2a', '#6e4a2c', '#4a3a3a', '#7a5a3a'][i],
        { roughness: 0.6 },
      );
      jar.position.set(-6 + i * 0.7, floorY + 0.08, HZ + 0.1);
      g.add(jar);
    }
    const tikar = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), mat('#c9a86a', { map: weaveTexture() }));
    tikar.rotation.x = -Math.PI / 2;
    tikar.position.set(-3, floorY + 0.09, HZ - 1.2);
    g.add(tikar);
    const slip = slippers('#3a6ab0');
    slip.position.set(1.1, floorY + 0.1, HZ - depth / 2 + 0.4);
    g.add(slip);

    // ---------------- the loom (backstrap), set up on the ruai
    const loom = new THREE.Group();
    const barMat = mat('#8a6a3a');
    const farBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), barMat);
    farBar.rotation.z = Math.PI / 2;
    farBar.position.set(0, 0.45, -0.9);
    const nearBar = farBar.clone();
    nearBar.position.set(0, 0.3, 0.3);
    loom.add(farBar, nearBar);
    for (const x of [-0.6, 0.6]) {
      const leg = cyl(0.03, 0.03, 0.5, 6, '#6e4a2c');
      leg.position.set(x, 0.25, -0.9);
      loom.add(leg);
    }
    // warp threads: a semi-transparent cream plane; the woven cloth grows from the near bar
    this.warp = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.2, 1, 1), mat('#e8d6b0', { transparent: true, opacity: 0.55, side: THREE.DoubleSide, flat: false }));
    this.warp.rotation.x = -Math.PI / 2 + 0.12;
    this.warp.position.set(0, 0.38, -0.3);
    loom.add(this.warp);
    const puaMat = mat('#9a2f24', { map: puaTexture(21), side: THREE.DoubleSide, flat: false });
    this.woven = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1), puaMat);
    this.woven.rotation.x = -Math.PI / 2 + 0.12;
    this.woven.position.set(0, 0.385, 0.3);
    this.woven.scale.y = 0.001;
    loom.add(this.woven);
    // thread lines for texture
    for (let i = 0; i < 12; i++) {
      const th = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.002, 1.2), mat('#c9b07a'));
      th.position.set(-0.45 + i * 0.082, 0.395 - i * 0.0005, -0.3);
      th.rotation.x = 0.12;
      loom.add(th);
    }
    this.shuttle = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.05), mat('#3f2a18', { roughness: 0.5 }));
    this.shuttle.position.set(-0.55, 0.42, -0.1);
    loom.add(this.shuttle);
    // a spool of red thread
    const spool = cyl(0.04, 0.04, 0.09, 10, '#9a2f24');
    spool.rotation.z = Math.PI / 2;
    spool.position.set(0.7, 0.05, 0.3);
    loom.add(spool);
    loom.position.set(-2.5, floorY + 0.08, HZ - depth / 2 + 1.5);
    loom.rotation.y = 0.15;
    g.add(loom);
    const loomProxy = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 1.5), mat('#000000'));
    loomProxy.visible = false;
    loomProxy.position.set(0, 0.4, -0.3);
    loom.add(loomProxy);
    this.add({
      id: 'panjai-loom',
      object: loomProxy,
      gestures: ['drag', 'tap'],
      hint: () => (this.rows < 8 ? 'Drag across to pass the shuttle' : 'Drag to weave another row'),
      markerSize: 0.32,
      range: 9,
      onDragStart: () => {
        this.dragAcc = 0;
      },
      onDrag: (dx) => {
        this.dragAcc += Math.abs(dx);
        if (this.dragAcc > 0.12 && !this.shuttleMoving) {
          this.dragAcc = 0;
          this.pass();
        }
      },
      onTap: () => {
        if (!this.shuttleMoving) this.pass();
      },
    });

    // ---------------- engkerumong: small gongs in a row at the far end of the ruai
    const rack = new THREE.Group();
    const rackBase = box(1.6, 0.06, 0.4, '#6e4a2c', { map: dark });
    rackBase.position.y = 0.35;
    for (const x of [-0.75, 0.75]) {
      const leg = box(0.06, 0.35, 0.36, '#6e4a2c');
      leg.position.set(x, 0.17, 0);
      rack.add(leg);
    }
    rack.add(rackBase);
    const gongMat = mat('#b08a3a', { roughness: 0.45, metalness: 0.7, flat: false });
    for (let i = 0; i < 6; i++) {
      const r = 0.14 - i * 0.012;
      const gong = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 0.1, 16), gongMat);
      gong.position.set(-0.62 + i * 0.25, 0.43, 0);
      shadow(gong);
      rack.add(gong);
      const boss = new THREE.Mesh(new THREE.SphereGeometry(r * 0.3, 8, 6), mat('#8a6a2a', { metalness: 0.7, roughness: 0.5, flat: false }));
      boss.position.set(gong.position.x, 0.49, 0);
      rack.add(boss);
      this.gongs.push({ mesh: gong, swing: 0 });
      this.add({
        id: `panjai-engkerumong-${i}`,
        object: gong,
        gestures: ['tap'],
        hint: 'Tap to play the engkerumong',
        markerSize: 0.18,
        range: 9,
        onTap: () => {
          this.gongs[i].swing = 1;
          this.ctx.music.play('engkerumong', 7 + i, 0.8);
          this.memory('engkerumong');
        },
      });
    }
    rack.position.set(4.5, floorY + 0.08, HZ - depth / 2 + 1.2);
    rack.rotation.y = -0.3;
    g.add(rack);

    // ---------------- kek lapis on a plate
    const plate = cyl(0.22, 0.2, 0.02, 16, '#f6efe2');
    plate.position.set(-4.6, floorY + 0.1, HZ - 1.1);
    g.add(plate);
    const lapis = new THREE.Group();
    const cakeMat = mat('#f2c14e', { map: lapisTexture(), flat: false });
    for (let i = 0; i < 5; i++) {
      const slice = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.22), cakeMat);
      slice.position.set(-0.12 + i * 0.062, 0.09, 0);
      lapis.add(slice);
      this.lapisSlices.push(slice);
    }
    const knife = box(0.02, 0.005, 0.2, '#c0c4c8', { metalness: 0.6, roughness: 0.3 });
    knife.position.set(0.24, 0.005, 0.02);
    lapis.add(knife);
    lapis.position.copy(plate.position).add(new THREE.Vector3(0, 0.01, 0));
    g.add(lapis);
    this.add({
      id: 'panjai-lapis',
      object: lapis,
      gestures: ['tap'],
      hint: 'Tap to cut a slice of kek lapis',
      markerSize: 0.22,
      range: 10,
      enabled: () => this.sliceIndex < this.lapisSlices.length,
      onTap: () => this.cutSlice(),
    });
  }

  private pass() {
    this.shuttleMoving = true;
    this.shuttleT = 0;
    this.ctx.synth.shuttle();
  }

  private cutSlice() {
    const slice = this.lapisSlices[this.sliceIndex++];
    if (!slice) return;
    this.ctx.synth.woodKnock(0.4);
    const start = slice.position.clone();
    const t0 = performance.now();
    const anim = () => {
      const t = Math.min(1, (performance.now() - t0) / 500);
      slice.position.set(start.x - t * 0.12, start.y + Math.sin(t * Math.PI) * 0.05 - t * 0.0, start.z + t * 0.14);
      slice.rotation.y = t * 0.6;
      if (t < 1) requestAnimationFrame(anim);
    };
    anim();
    if (this.sliceIndex === 1) this.memory('lapis');
  }

  override update(dt: number, time: number) {
    this.tickSeat(dt);
    if (this.shuttleMoving) {
      this.shuttleT += dt * 1.8;
      const t = Math.min(1, this.shuttleT);
      const e = t * t * (3 - 2 * t);
      this.shuttle.position.x = THREE.MathUtils.lerp(-0.55 * this.shuttleDir, 0.55 * this.shuttleDir, e);
      this.shuttle.position.y = 0.42 + Math.sin(t * Math.PI) * 0.03;
      if (t >= 1) {
        this.shuttleMoving = false;
        this.shuttleDir *= -1;
        this.rows++;
        const grow = Math.min(1.0, 0.001 + this.rows * 0.11);
        this.woven.scale.y = grow;
        this.woven.position.z = 0.3 - (grow * 1.0) / 2;
        const warpLen = Math.max(0.05, 1.2 - grow * 1.0);
        this.warp.scale.y = warpLen / 1.2;
        this.warp.position.z = -0.9 + warpLen / 2;
        this.ctx.music.play('engkerumong', 9 + (this.rows % 4), 0.35);
        if (this.rows >= 8) this.complete('loom');
      }
    }
    for (const gg of this.gongs) {
      if (gg.swing > 0.001) {
        gg.swing = Math.max(0, gg.swing - dt * 0.9);
        gg.mesh.position.y = 0.43 + Math.abs(Math.sin(time * 14)) * 0.02 * gg.swing;
      }
    }
  }
}
