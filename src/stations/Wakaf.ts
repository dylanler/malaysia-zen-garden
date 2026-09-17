import * as THREE from 'three';
import { Station } from './Station';
import { box, cyl, cone, mat, shadow, cup } from '../world/props';
import { zincTexture, plankTexture } from '../world/textures';
import { makeWaterMaterial } from '../world/Water';
import { Emitter } from '../world/Particles';

export class Wakaf extends Station {
  private paperStage = 0; // 0 sheet, 1 half, 2 boat (on bench), 3 afloat, 4 gone
  private paperStates: THREE.Object3D[] = [];
  private boat!: THREE.Group;
  private boatT = 0;
  private drainY = 0;
  private drips!: Emitter;
  private rainStarted = false;
  private satMemory = false;
  private enterTime = 0;

  build() {
    const g = this.group;
    const zinc = zincTexture();
    const wood = plankTexture('#a87b50', '#6e4a2c');

    // ---------------- the wakaf straddles the path: a roadside shelter
    const slab = box(4.6, 0.06, 4.6, '#9a9a94');
    slab.position.y = 0.03;
    g.add(slab);
    for (const [x, z] of [
      [-2, -2],
      [2, -2],
      [-2, 2],
      [2, 2],
    ]) {
      const post = cyl(0.09, 0.1, 2.6, 6, '#6e4a2c');
      post.position.set(x, 1.3, z);
      g.add(post);
    }
    const roof = cone(3.6, 1.5, 4, '#8e9299', { map: zinc, side: THREE.DoubleSide });
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 2.6 + 0.75;
    g.add(roof);
    const ring = box(4.4, 0.12, 4.4, '#6e4a2c');
    ring.position.y = 2.55;
    g.add(ring);
    // bench along the back, facing the lake
    const bench = box(3.4, 0.07, 0.45, '#b08458', { map: wood });
    bench.position.set(0, 0.5, 1.6);
    for (const x of [-1.5, 1.5]) {
      const leg = box(0.1, 0.5, 0.4, '#6e4a2c');
      leg.position.set(x, 0.25, 1.6);
      g.add(leg);
    }
    g.add(bench);
    // side benches
    for (const x of [-1.8, 1.8]) {
      const sb = box(0.45, 0.07, 2.6, '#b08458', { map: wood });
      sb.position.set(x, 0.5, 0.2);
      g.add(sb);
    }
    // a cup of kopi left behind, and a folded newspaper
    const kopi = cup('#f6efe2', 0.04, 0.07);
    kopi.position.set(-1.2, 0.54, 1.6);
    g.add(kopi);
    const paperRoll = box(0.32, 0.02, 0.22, '#e8e2d2');
    paperRoll.position.set(-0.7, 0.55, 1.62);
    paperRoll.rotation.y = 0.2;
    g.add(paperRoll);
    this.addSeat('bench', bench, new THREE.Vector3(0.3, 1.45, 1.55), new THREE.Vector3(0.3, 0.6, -30), 'Tap to sit under the roof');

    // ---------------- longkang between the path and the lake
    this.drainY = 0.0;
    const concrete = mat('#8f8f88', { roughness: 0.95 });
    for (const z of [-3.1, -2.5]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 0.12), concrete);
      wall.position.set(0, 0.1, z);
      shadow(wall);
      g.add(wall);
    }
    const bed = new THREE.Mesh(new THREE.BoxGeometry(16, 0.06, 0.6), concrete);
    bed.position.set(0, -0.1, -2.8);
    g.add(bed);
    const flowMat = this.ctx.water.track(makeWaterMaterial({ scale: 1.2, flow: new THREE.Vector2(0.35, 0.02), opacity: 0.9 }));
    const drainWater = new THREE.Mesh(new THREE.PlaneGeometry(15.8, 0.5), flowMat);
    drainWater.rotation.x = -Math.PI / 2;
    drainWater.position.set(0, this.drainY, -2.8);
    drainWater.renderOrder = 2;
    g.add(drainWater);
    const drainWorld = this.local(0, 0, -2.8);
    this.ctx.ambience.emitters.push({ layer: 'drain', pos: drainWorld, radius: 9, gain: 0.3 });

    // ---------------- exercise-book paper on the bench
    const paperMat = mat('#f2eee2', { side: THREE.DoubleSide, flat: false });
    const lineMat = mat('#9fb3d8', { side: THREE.DoubleSide, flat: false });
    const sheet = new THREE.Group();
    const sheetPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.3), paperMat);
    sheetPlane.rotation.x = -Math.PI / 2;
    sheet.add(sheetPlane);
    for (let i = 0; i < 9; i++) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.003), lineMat);
      l.rotation.x = -Math.PI / 2;
      l.position.set(0, 0.001, -0.12 + i * 0.03);
      sheet.add(l);
    }
    const half = new THREE.Group();
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.16), paperMat);
      p.position.set(0, 0.05, s * 0.05);
      p.rotation.x = -s * 0.9;
      half.add(p);
    }
    this.boat = new THREE.Group();
    for (const s of [-1, 1]) {
      const hull = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.07), paperMat);
      hull.position.set(0, 0.035, s * 0.035);
      hull.rotation.x = -s * 0.5;
      this.boat.add(hull);
    }
    const sailGeo = new THREE.BufferGeometry();
    sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.05, 0.06, 0, 0.05, 0.06, 0, 0, 0.14, 0], 3));
    sailGeo.computeVertexNormals();
    const sail = new THREE.Mesh(sailGeo, paperMat);
    this.boat.add(sail);
    for (const st of [sheet, half, this.boat]) {
      st.position.set(1.0, 0.54, 1.5);
      st.visible = false;
      g.add(st);
    }
    sheet.visible = true;
    this.paperStates = [sheet, half, this.boat];
    // a large invisible target so the paper is easy to tap
    const paperProxy = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.45), mat('#000000'));
    paperProxy.visible = false;
    paperProxy.position.set(1.0, 0.6, 1.5);
    g.add(paperProxy);
    this.add({
      id: 'wakaf-paper',
      object: paperProxy,
      gestures: ['tap'],
      hint: () => ['Tap to fold the paper', 'Tap to fold it again', 'Tap to lift the sail'][this.paperStage] ?? '',
      markerSize: 0.26,
      enabled: () => this.paperStage < 2,
      onTap: () => this.fold(),
    });
    const drainProxy = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 0.9), mat('#000000'));
    drainProxy.visible = false;
    drainProxy.position.set(0, 0.1, -2.8);
    g.add(drainProxy);
    this.add({
      id: 'wakaf-drain',
      object: drainProxy,
      gestures: ['tap'],
      hint: 'Tap the longkang to set the boat afloat',
      markerSize: 0.32,
      markerOffset: new THREE.Vector3(0, 0.2, 0),
      enabled: () => this.paperStage === 2,
      onTap: () => this.launchBoat(),
    });

    // rain dripping off the eaves
    this.drips = new Emitter({
      count: 160,
      color: '#dfeeff',
      size: 0.06,
      life: [0.55, 0.7],
      spawn: () => {
        const side = Math.floor(Math.random() * 4);
        const t = (Math.random() - 0.5) * 4.6;
        const e = 2.35;
        const p = side === 0 ? new THREE.Vector3(t, 2.5, -e) : side === 1 ? new THREE.Vector3(t, 2.5, e) : side === 2 ? new THREE.Vector3(-e, 2.5, t) : new THREE.Vector3(e, 2.5, t);
        return p;
      },
      velocity: () => new THREE.Vector3(0, -1.5, 0),
      gravity: -6,
      opacity: 0.7,
    });
    g.add(this.drips.points);
  }

  private fold() {
    if (this.paperStage >= 2) return;
    this.paperStates[this.paperStage].visible = false;
    this.paperStage++;
    const next = this.paperStates[this.paperStage];
    next.visible = true;
    next.scale.setScalar(0.8);
    const t0 = performance.now();
    const anim = () => {
      const t = Math.min(1, (performance.now() - t0) / 220);
      next.scale.setScalar(0.8 + 0.2 * t);
      if (t < 1) requestAnimationFrame(anim);
    };
    anim();
    this.ctx.synth.paperFold();
  }

  private launchBoat() {
    if (this.paperStage !== 2) return;
    this.paperStage = 3;
    this.boatT = 0;
    this.boat.position.set(-3.5, this.drainY + 0.01, -2.8);
    this.boat.rotation.y = 0;
    this.ctx.synth.splash(0.25);
    const w = this.local(-3.5, this.drainY, -2.8);
    this.ctx.ripples.spawn(w.x, w.y, w.z, 0.6, 1);
    this.ctx.music.play('plink', 10, 0.5);
    window.setTimeout(() => this.complete('boat'), 1500);
  }

  override enter() {
    super.enter();
    this.enterTime = performance.now();
    this.rainStarted = false;
    const w = this.ctx.weather;
    if (w.state !== 'rain') w.gather();
  }

  override exit() {
    super.exit();
    this.ctx.weather.sheltered = false;
    // heading on toward the padi, the rain thins to gold
    const u = this.ctx.locomotion.u;
    if (u > this.ctx.path.stationU.wakaf + 0.01 || this.completed) this.ctx.weather.ease();
  }

  override update(dt: number, _time: number) {
    this.tickSeat(dt);
    const w = this.ctx.weather;
    if (this.active) {
      if (!this.rainStarted && performance.now() - this.enterTime > 5000) {
        this.rainStarted = true;
        w.startRain();
      }
      const p = this.group.worldToLocal(this.ctx.camera.position.clone());
      w.sheltered = Math.abs(p.x) < 2.4 && Math.abs(p.z) < 2.4;
      if (this.seatedId && this.sitTime > 8 && !this.satMemory) {
        this.satMemory = true;
        this.memory('sit');
        if (w.rain > 0.5) this.complete();
      }
    }
    this.drips.rate = w.rain > 0.25 ? 45 * w.rain : 0;
    this.drips.update(dt);
    if (this.paperStage === 3) {
      this.boatT += dt;
      this.boat.position.x += dt * 0.55;
      this.boat.position.y = this.drainY + 0.01 + Math.sin(this.boatT * 5) * 0.006;
      this.boat.rotation.z = Math.sin(this.boatT * 3.2) * 0.08;
      this.boat.rotation.y = Math.sin(this.boatT * 1.1) * 0.2;
      if (this.boat.position.x > 7.4) {
        this.paperStage = 4;
        this.boat.visible = false;
      }
    }
  }
}
