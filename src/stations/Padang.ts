import * as THREE from 'three';
import { Station } from './Station';
import { box, cyl, mat, shadow, gableRoof, cup, slippers } from '../world/props';
import { wauTexture, zincTexture, weaveTexture, plankTexture } from '../world/textures';
import { Drone } from '../audio/Synth';
import { damp } from '../core/util';

type WauState = 'leaning' | 'rising' | 'flying' | 'reeling';

export class Padang extends Station {
  private wau!: THREE.Group;
  private wauRest = new THREE.Vector3();
  private wauRestRot = new THREE.Euler();
  private state: WauState = 'leaning';
  private stringLen = 0;
  private stringTarget = 0;
  private lettingOut = false;
  private stringLine!: THREE.Line;
  private stringGeo!: THREE.BufferGeometry;
  private hum: Drone;
  private hummed = false;
  private anchor = new THREE.Vector3();
  private stones: THREE.Mesh[] = [];
  private tossing = false;
  private tosses = 0;
  private cupTaken = false;
  private cupMesh!: THREE.Group;
  private t = 0;
  private windDir = new THREE.Vector3();

  constructor(ctx: ConstructorParameters<typeof Station>[0], def: ConstructorParameters<typeof Station>[1]) {
    super(ctx, def);
    this.hum = new Drone(ctx.audio, 'hum', 'sfx');
  }

  build() {
    const g = this.group;
    const zinc = zincTexture();
    const wood = plankTexture('#a87b50', '#6e4a2c');

    // ---------------- pondok
    const pondok = new THREE.Group();
    for (const [x, z] of [
      [-1.4, -1.4],
      [1.4, -1.4],
      [-1.4, 1.4],
      [1.4, 1.4],
    ]) {
      const post = cyl(0.07, 0.08, 2.4, 6, '#6e4a2c');
      post.position.set(x, 1.2, z);
      pondok.add(post);
    }
    const roof = gableRoof(3.4, 3.2, 1.0, '#8e9299', zinc, 0.4);
    roof.position.y = 2.4;
    pondok.add(roof);
    const bench = box(2.4, 0.06, 0.4, '#b08458', { map: wood });
    bench.position.set(0, 0.45, 1.0);
    for (const x of [-1, 1]) {
      const leg = box(0.08, 0.45, 0.35, '#6e4a2c');
      leg.position.set(x, 0.225, 1.0);
      pondok.add(leg);
    }
    pondok.add(bench);
    const slip = slippers('#3a6ab0');
    slip.position.set(0.7, 0.02, 0.4);
    pondok.add(slip);
    this.settle(pondok, 2.5, 5.5);
    g.add(pondok);
    this.addSeat('pondok', bench, new THREE.Vector3(2.5, 1.15, 6.6), new THREE.Vector3(2.5, 4, -40), 'Tap to sit in the pondok');

    // ---------------- the wau bulan, leaning on a post
    this.wau = this.buildWau();
    this.wauRest.set(2.5 - 1.75, 0.75, 5.5 - 1.4);
    this.wauRestRot.set(-0.25, 0.4, 0.15);
    this.wau.position.copy(this.wauRest);
    this.wau.rotation.copy(this.wauRestRot);
    g.add(this.wau);
    // string
    this.stringGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.stringLine = new THREE.Line(this.stringGeo, new THREE.LineBasicMaterial({ color: 0xf6efe2, transparent: true, opacity: 0.55 }));
    this.stringLine.frustumCulled = false;
    this.stringLine.visible = false;
    this.ctx.scene.add(this.stringLine);
    // the wind blows out over the lake
    this.windDir.set(0.35, 0, -1).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.angle);

    this.add({
      id: 'padang-wau',
      object: this.wau,
      gestures: ['tap'],
      hint: () => (this.state === 'leaning' ? 'Tap to pick up the wau' : this.state === 'flying' ? 'Tap the wau to bring it down' : ''),
      range: 120,
      markerSize: 0.5,
      enabled: () => (this.state === 'leaning' && this.distanceToPlayer() < 9) || this.state === 'flying',
      onTap: () => {
        if (this.state === 'leaning') this.launch();
        else if (this.state === 'flying') this.reelIn();
      },
    });

    // ---------------- the green van, sliding door open
    const van = new THREE.Group();
    const bodyMat = mat('#2f7a3a', { roughness: 0.5, metalness: 0.1 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.7, 1.8), bodyMat);
    body.position.y = 1.35;
    shadow(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 1.7), bodyMat);
    cab.position.set(2.5, 1.1, 0);
    shadow(cab);
    const windscreen = box(0.06, 0.7, 1.4, '#a9c7e0', { roughness: 0.2, metalness: 0.3 });
    windscreen.position.set(3.03, 1.3, 0);
    const opening = box(1.6, 1.2, 0.05, '#101418');
    opening.position.set(0.4, 1.2, -0.9);
    const stripe = box(4.2, 0.12, 1.82, '#f6efe2');
    stripe.position.y = 1.0;
    van.add(body, cab, windscreen, opening, stripe);
    for (const [x, z] of [
      [-1.4, -0.9],
      [1.4, -0.9],
      [-1.4, 0.9],
      [1.4, 0.9],
    ]) {
      const wheel = cyl(0.38, 0.38, 0.25, 12, '#222222');
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.4, z);
      van.add(wheel);
    }
    // a folding table with a cooler and paper cups
    const tbl = box(1.2, 0.04, 0.5, '#e8dcc4');
    tbl.position.set(0.4, 0.7, -1.5);
    for (const x of [-0.1, 0.9]) {
      const leg = cyl(0.02, 0.02, 0.7, 6, '#888888');
      leg.position.set(x, 0.35, -1.5);
      van.add(leg);
    }
    const cooler = box(0.5, 0.35, 0.35, '#d8262f');
    cooler.position.set(0.05, 0.9, -1.5);
    const lid = box(0.52, 0.06, 0.37, '#f6efe2');
    lid.position.set(0.05, 1.1, -1.5);
    van.add(tbl, cooler, lid);
    this.cupMesh = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const c = cup('#f6efe2', 0.035, 0.08);
      c.position.set(0.5 + (i % 2) * 0.1, 0.72, -1.6 + Math.floor(i / 2) * 0.12);
      this.cupMesh.add(c);
    }
    van.add(this.cupMesh);
    this.settle(van, -6.5, 6.5);
    van.rotation.y = 0.5;
    g.add(van);
    this.add({
      id: 'padang-van',
      object: this.cupMesh,
      gestures: ['tap'],
      hint: 'Tap to take a cold drink',
      markerSize: 0.3,
      enabled: () => !this.cupTaken,
      onTap: () => {
        this.cupTaken = true;
        this.cupMesh.children[0].visible = false;
        this.ctx.synth.clink();
        this.memory('van');
      },
    });

    // ---------------- batu seremban on a tikar
    const tikar = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), mat('#c9a86a', { map: weaveTexture() }));
    tikar.rotation.x = -Math.PI / 2;
    tikar.receiveShadow = true;
    this.settle(tikar, -1.5, 3.0, 0.02);
    tikar.rotation.z = 0.3;
    g.add(tikar);
    const stoneGroup = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.035, 0), mat(['#8a8f96', '#6f7a86', '#9a9086'][i % 3]));
      st.position.set((Math.random() - 0.5) * 0.3, 0.035, (Math.random() - 0.5) * 0.25);
      st.rotation.set(Math.random(), Math.random(), Math.random());
      stoneGroup.add(st);
      this.stones.push(st);
    }
    // a wider invisible target so the small stones are easy to tap
    const stoneProxy = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 10), mat('#000000'));
    stoneProxy.visible = false;
    stoneProxy.position.y = 0.05;
    stoneGroup.add(stoneProxy);
    this.settle(stoneGroup, -1.5, 3.0);
    g.add(stoneGroup);
    this.add({
      id: 'padang-seremban',
      object: stoneGroup,
      gestures: ['tap'],
      hint: 'Tap to toss the batu seremban',
      markerSize: 0.28,
      enabled: () => !this.tossing,
      onTap: () => this.toss(),
    });

    // goal posts at either end of the field, a shared memory of every school
    for (const x of [-11, 11]) {
      const posts = new THREE.Group();
      for (const z of [-1.8, 1.8]) {
        const p = cyl(0.05, 0.05, 2.4, 6, '#f6efe2');
        p.position.set(0, 1.2, z);
        posts.add(p);
      }
      const bar = cyl(0.05, 0.05, 3.7, 6, '#f6efe2');
      bar.rotation.x = Math.PI / 2;
      bar.position.y = 2.4;
      posts.add(bar);
      this.settle(posts, x, -4);
      g.add(posts);
    }
  }

  private buildWau() {
    const g = new THREE.Group();
    const tex = wauTexture();
    const skin = mat('#f4efe6', { map: tex, side: THREE.DoubleSide, flat: false });
    // upper wing: a wide leaf shape
    const wing = new THREE.Shape();
    wing.moveTo(0, 0.55);
    wing.bezierCurveTo(0.55, 0.55, 0.75, 0.2, 0.7, -0.05);
    wing.bezierCurveTo(0.6, -0.3, 0.2, -0.35, 0, -0.32);
    wing.bezierCurveTo(-0.2, -0.35, -0.6, -0.3, -0.7, -0.05);
    wing.bezierCurveTo(-0.75, 0.2, -0.55, 0.55, 0, 0.55);
    const wingMesh = new THREE.Mesh(new THREE.ShapeGeometry(wing, 16), skin);
    // the "bulan": crescent tail
    const tail = new THREE.Shape();
    tail.moveTo(0, -0.28);
    tail.bezierCurveTo(0.45, -0.3, 0.55, -0.75, 0.2, -0.95);
    tail.bezierCurveTo(0.1, -0.7, -0.1, -0.7, -0.2, -0.95);
    tail.bezierCurveTo(-0.55, -0.75, -0.45, -0.3, 0, -0.28);
    const tailMesh = new THREE.Mesh(new THREE.ShapeGeometry(tail, 16), skin);
    tailMesh.position.z = 0.002;
    g.add(wingMesh, tailMesh);
    // bamboo spars
    const spar = cyl(0.008, 0.008, 1.5, 5, '#c9b07a');
    spar.position.set(0, -0.2, 0.01);
    const cross = cyl(0.008, 0.008, 1.45, 5, '#c9b07a');
    cross.rotation.z = Math.PI / 2;
    cross.position.set(0, 0.12, 0.01);
    g.add(spar, cross);
    // the bow (busur) that hums: a thin arc above the wing
    const bowCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.6, 0.35, 0.02), new THREE.Vector3(0, 0.95, 0.02), new THREE.Vector3(0.6, 0.35, 0.02));
    const bow = new THREE.Mesh(new THREE.TubeGeometry(bowCurve, 12, 0.006, 4), mat('#c9b07a'));
    g.add(bow);
    // tassels
    for (const x of [-0.65, 0.65]) {
      const tassel = cyl(0.01, 0.03, 0.18, 5, '#d8262f');
      tassel.position.set(x, -0.1, 0);
      g.add(tassel);
    }
    g.scale.setScalar(1.15);
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    return g;
  }

  private launch() {
    this.state = 'rising';
    this.stringLen = 4;
    this.stringTarget = 10;
    this.stringLine.visible = true;
    this.ctx.synth.leaf(0.8);
    this.ctx.vegetation.pulse(0.6);
    this.ctx.interaction.globalHold = {
      hint: 'Hold anywhere to let out the string',
      onStart: () => {
        this.lettingOut = true;
      },
      onEnd: () => {
        this.lettingOut = false;
      },
    };
    window.setTimeout(() => {
      if (this.state === 'rising') this.state = 'flying';
    }, 1500);
  }

  private reelIn() {
    this.state = 'reeling';
    this.ctx.interaction.globalHold = null;
    this.lettingOut = false;
    this.hum.stop(1.2);
  }

  private toss() {
    this.tossing = true;
    this.tosses++;
    const starts = this.stones.map((s) => s.position.clone());
    const t0 = performance.now();
    let clicked = false;
    const anim = () => {
      const t = Math.min(1, (performance.now() - t0) / 700);
      this.stones.forEach((s, i) => {
        const h = Math.sin(t * Math.PI) * (0.35 + i * 0.05);
        s.position.set(starts[i].x + Math.sin(i + t * 3) * 0.04 * t, 0.035 + h, starts[i].z + Math.cos(i * 2 + t * 3) * 0.04 * t);
        s.rotation.x += 0.15;
        s.rotation.z += 0.1;
      });
      if (t > 0.85 && !clicked) {
        clicked = true;
        this.ctx.synth.stoneClick();
        window.setTimeout(() => this.ctx.synth.stoneClick(), 60);
        window.setTimeout(() => this.ctx.synth.stoneClick(), 130);
      }
      if (t < 1) requestAnimationFrame(anim);
      else {
        this.tossing = false;
        if (this.tosses >= 2) this.memory('seremban');
      }
    };
    this.ctx.synth.stoneClick();
    anim();
  }

  override exit() {
    super.exit();
    if (this.state !== 'leaning') this.reelIn();
  }

  override update(dt: number, time: number) {
    this.t = time;
    this.tickSeat(dt);
    if (this.state === 'leaning') return;

    // anchor: the player's hands
    this.ctx.locomotion.handPosition(this.anchor);
    if (this.state === 'reeling') {
      this.stringTarget = 0;
      this.stringLen = damp(this.stringLen, 0, 1.2, dt);
      if (this.stringLen < 1.5) {
        this.state = 'leaning';
        this.stringLine.visible = false;
        this.wau.position.copy(this.wauRest);
        this.wau.rotation.copy(this.wauRestRot);
        this.wau.scale.setScalar(1.15);
        this.ctx.synth.leaf(0.5);
        return;
      }
    } else {
      if (this.lettingOut && this.state === 'flying') this.stringTarget = Math.min(70, this.stringTarget + dt * 9);
      this.stringLen = damp(this.stringLen, this.stringTarget, 0.9, dt);
    }

    // kite position: downwind of the hands, climbing with string length
    const L = this.stringLen;
    const elev = THREE.MathUtils.lerp(0.55, 0.95, Math.min(1, L / 70));
    const sway = Math.sin(time * 0.7) * 0.08 + Math.sin(time * 1.9) * 0.03;
    const dir = this.windDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), sway).multiplyScalar(Math.cos(elev));
    dir.y = Math.sin(elev);
    const kitePos = this.anchor.clone().add(dir.multiplyScalar(L));
    kitePos.y += Math.sin(time * 1.3) * 0.4 * Math.min(1, L / 20);
    const local = this.group.worldToLocal(kitePos.clone());
    this.wau.position.copy(local);
    // face the wind, belly to the player
    const toAnchor = this.anchor.clone().sub(kitePos).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), toAnchor);
    const qLocal = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.angle).multiply(q);
    this.wau.quaternion.copy(qLocal);
    this.wau.rotateZ(Math.sin(time * 1.1) * 0.12);
    this.wau.scale.setScalar(1.15 + Math.min(1, L / 70) * 0.6);

    // string
    const pos = this.stringGeo.attributes.position as THREE.BufferAttribute;
    const mid = this.anchor.clone().lerp(kitePos, 0.5);
    mid.y -= Math.min(6, L * 0.08);
    pos.setXYZ(0, this.anchor.x, this.anchor.y, this.anchor.z);
    pos.setXYZ(1, kitePos.x, kitePos.y, kitePos.z);
    pos.needsUpdate = true;

    // the bow hums once there is enough line out
    const humLevel = THREE.MathUtils.clamp((L - 22) / 40, 0, 1);
    if (humLevel > 0.02 && this.state === 'flying') {
      if (!this.hum.playing) this.hum.start([118], 0.001);
      this.hum.setLevel(0.02 + humLevel * 0.22, 0.4);
      this.hum.setFilter(380 + humLevel * 260 + Math.sin(time * 2.1) * 40);
      if (humLevel > 0.6 && !this.hummed) {
        this.hummed = true;
        this.complete('wau');
      }
    } else if (this.hum.playing && this.state !== 'flying') {
      this.hum.stop(1);
    }
    void this.t;
  }
}
