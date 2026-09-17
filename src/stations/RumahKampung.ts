import * as THREE from 'three';
import { Station } from './Station';
import { box, cyl, cone, sphere, lathe, mat, at, gableRoof, stilts, flameSprite, glowSprite, cloth, slippers, shadow } from '../world/props';
import { plankTexture, zincTexture, batikTexture, plaidTexture, weaveTexture, paperTexture, leafTexture, signTexture } from '../world/textures';
import { makeWaterMaterial } from '../world/Water';
import { Emitter } from '../world/Particles';
import { Unwrap, type UnwrapStage } from '../systems/Unwrap';
import { ENDING_TEXT } from '../content/stations';
import { haptic } from '../core/Interaction';

interface Pelita {
  flame: THREE.Sprite;
  glow: THREE.Sprite;
  lit: boolean;
  pos: THREE.Vector3;
}

export class RumahKampung extends Station {
  private pelita: Pelita[] = [];
  private pelitaLights: THREE.PointLight[] = [];
  private houseLamp!: THREE.Mesh;
  private houseLight!: THREE.PointLight;
  private ending = false;
  private loopRequested = false;
  private tempayanWater!: THREE.Mesh;
  private gayung!: THREE.Group;
  private pouring = false;
  private pourTime = 0;
  private pourEmitter!: Emitter;
  private congkakSeeds: THREE.Mesh[] = [];
  private sows = 0;
  private sowing = false;
  private unwrap: Unwrap | null = null;
  private steam!: Emitter;
  private revealed = false;
  private coilSmoke!: Emitter;
  private time = 0;

  get returnMode() {
    const h = this.ctx.time.hour;
    return h >= 19.5 || h < 4.5;
  }

  override targetHour() {
    return this.returnMode ? 21.6 : 6.75;
  }

  build() {
    const g = this.group;
    const wood = plankTexture('#a87b50', '#6e4a2c');
    const darkWood = plankTexture('#6e4a2c', '#3f2a18');
    const zinc = zincTexture();

    // ---------------- the house, on stilts, facing the lake
    const house = new THREE.Group();
    const floorY = 1.7;
    const platform = box(6.2, 0.14, 5, '#b08458', { map: wood });
    platform.position.y = floorY;
    house.add(platform);
    house.add(stilts(5.6, 4.4, floorY, 4, '#5a3d26'));
    const wallMat = mat('#c69a6a', { map: wood });
    const wallH = 2.4;
    const back = new THREE.Mesh(new THREE.BoxGeometry(6.2, wallH, 0.1), wallMat);
    back.position.set(0, floorY + wallH / 2, 2.45);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.1, wallH, 5), wallMat);
    left.position.set(-3.05, floorY + wallH / 2, 0);
    const right = left.clone();
    right.position.x = 3.05;
    for (const w of [back, left, right]) shadow(w);
    // front wall with a door and two louvred windows
    const frontL = new THREE.Mesh(new THREE.BoxGeometry(2.2, wallH, 0.1), wallMat);
    frontL.position.set(-2, floorY + wallH / 2, -2.45);
    const frontR = frontL.clone();
    frontR.position.x = 2;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.1), wallMat);
    lintel.position.set(0, floorY + wallH - 0.25, -2.45);
    for (const w of [frontL, frontR, lintel]) shadow(w);
    const door = box(1.7, wallH - 0.5, 0.06, '#2a2a3a');
    door.position.set(0, floorY + (wallH - 0.5) / 2, -2.44);
    house.add(back, left, right, frontL, frontR, lintel, door);
    for (const wx of [-2, 2]) {
      const win = box(1.1, 1.0, 0.06, '#1f2a44');
      win.position.set(wx, floorY + 1.45, -2.44);
      house.add(win);
      for (let i = 0; i < 5; i++) {
        const louvre = box(1.12, 0.05, 0.1, '#e8dcc4');
        louvre.position.set(wx, floorY + 1.05 + i * 0.2, -2.46);
        louvre.rotation.x = 0.5;
        house.add(louvre);
      }
      const frame = box(1.2, 0.06, 0.12, '#e8dcc4');
      frame.position.set(wx, floorY + 1.98, -2.46);
      house.add(frame);
    }
    const roof = gableRoof(6.6, 5.2, 1.9, '#8e9299', zinc, 0.5);
    roof.position.y = floorY + wallH;
    house.add(roof);
    // anjung (verandah)
    const anjung = box(6.2, 0.12, 1.8, '#b08458', { map: wood });
    anjung.position.set(0, floorY, -3.4);
    house.add(anjung, stilts(5.6, 1.2, floorY, 4, '#5a3d26'));
    for (const x of [-3, -1.2, 1.2, 3]) {
      const post = cyl(0.05, 0.05, 1.0, 6, '#e8dcc4');
      post.position.set(x, floorY + 0.5, -4.25);
      house.add(post);
    }
    const rail = box(6.1, 0.05, 0.05, '#e8dcc4');
    rail.position.set(0, floorY + 1.0, -4.25);
    const rail2 = box(6.1, 0.04, 0.04, '#e8dcc4');
    rail2.position.set(0, floorY + 0.5, -4.25);
    house.add(rail, rail2);
    // verandah roof: a lower lean-to
    const lean = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.06, 2.3), mat('#8e9299', { map: zinc, side: THREE.DoubleSide }));
    lean.position.set(0, floorY + wallH - 0.15, -3.5);
    lean.rotation.x = 0.28;
    shadow(lean);
    house.add(lean);
    // stairs (tangga) down from the anjung
    const stairs = new THREE.Group();
    const steps = 6;
    const run = 0.32;
    for (let i = 0; i < steps; i++) {
      const s = box(1.0, 0.07, 0.34, '#a87b50', { map: darkWood });
      s.position.set(0, (floorY * (i + 0.5)) / steps, -4.5 - (steps - 1 - i) * run);
      stairs.add(s);
    }
    const stairLen = (steps - 1) * run;
    for (const side of [-0.55, 0.55]) {
      const stringer = box(0.08, 0.1, Math.hypot(stairLen, floorY) + 0.3, '#6e4a2c');
      stringer.position.set(side, floorY / 2, -4.5 - stairLen / 2);
      stringer.rotation.x = -Math.atan2(floorY, stairLen);
      stairs.add(stringer);
    }
    stairs.position.set(-1.6, 0, 0);
    house.add(stairs);
    // house lamp on the anjung (the last pelita)
    this.houseLamp = sphere(0.07, '#f4d9a8', 8, { emissive: '#f4d9a8', emissiveIntensity: 0 });
    this.houseLamp.position.set(0, floorY + wallH - 0.4, -3.4);
    this.houseLight = new THREE.PointLight('#ffb970', 0, 12, 1.6);
    this.houseLight.position.set(0, floorY + wallH - 0.6, -3.4);
    house.add(this.houseLamp, this.houseLight);
    // kerusi malas + slippers + radio: someone lives here
    const chair = new THREE.Group();
    const seat = box(0.55, 0.05, 0.9, '#c9a86a', { map: weaveTexture() });
    seat.position.set(0, 0.35, 0);
    seat.rotation.x = -0.35;
    const chairBack = box(0.55, 0.05, 0.6, '#c9a86a', { map: weaveTexture() });
    chairBack.position.set(0, 0.7, 0.35);
    chairBack.rotation.x = -1.1;
    chair.add(seat, chairBack);
    for (const [x, z] of [
      [-0.25, -0.35],
      [0.25, -0.35],
      [-0.25, 0.35],
      [0.25, 0.35],
    ]) {
      const leg = cyl(0.025, 0.025, 0.4, 6, '#8a6a3a');
      leg.position.set(x, 0.2, z);
      chair.add(leg);
    }
    chair.position.set(1.6, floorY + 0.06, -3.4);
    chair.rotation.y = -0.4;
    house.add(chair);
    const slip = slippers('#c04a4a');
    slip.position.set(-1.0, floorY + 0.07, -3.9);
    slip.rotation.y = 0.3;
    house.add(slip);
    const radio = new THREE.Group();
    const body = box(0.32, 0.18, 0.12, '#d9c9a3');
    const grille = box(0.16, 0.12, 0.01, '#3a3030');
    grille.position.set(-0.06, 0.0, -0.065);
    const dial = cyl(0.03, 0.03, 0.01, 12, '#2a2a2a');
    dial.rotation.x = Math.PI / 2;
    dial.position.set(0.1, 0.0, -0.065);
    const antenna = cyl(0.005, 0.005, 0.35, 4, '#aaaaaa');
    antenna.position.set(0.14, 0.22, 0);
    radio.add(body, grille, dial, antenna);
    radio.position.set(-2.4, floorY + 0.09 + 0.05, -3.0);
    house.add(radio);
    // mosquito coil on a saucer by the stairs (smokes at night)
    const saucer = cyl(0.12, 0.1, 0.02, 12, '#e8dcc4');
    saucer.position.set(-0.4, floorY + 0.07, -4.0);
    const coilCurve = new THREE.CatmullRomCurve3(
      Array.from({ length: 30 }, (_, i) => {
        const t = i / 29;
        const a = t * Math.PI * 6;
        const r = 0.02 + t * 0.07;
        return new THREE.Vector3(Math.cos(a) * r, 0.02, Math.sin(a) * r);
      }),
    );
    const coil = new THREE.Mesh(new THREE.TubeGeometry(coilCurve, 60, 0.006, 5), mat('#2e5a3a'));
    coil.position.set(-0.4, floorY + 0.09, -4.0);
    house.add(saucer, coil);
    house.position.set(0, 0, 8);
    g.add(house);

    this.coilSmoke = new Emitter({
      count: 40,
      color: '#cfd4dc',
      size: 0.35,
      life: [2.5, 4],
      spawn: () => new THREE.Vector3(-0.4, floorY + 0.12, 8 - 4.0),
      velocity: () => new THREE.Vector3((Math.random() - 0.5) * 0.05, 0.12 + Math.random() * 0.08, (Math.random() - 0.5) * 0.05),
      opacity: 0.16,
      growth: 1,
    });
    g.add(this.coilSmoke.points);

    // clothesline with kain pelikat and batik
    const lineY = 1.9;
    for (const z of [-1.5, 3.5]) {
      const post = cyl(0.04, 0.05, lineY + 0.1, 6, '#8a6a3a');
      this.settle(post, -5.2, z, (lineY + 0.1) / 2);
      g.add(post);
    }
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 5, 4), mat('#333333'));
    line.rotation.x = Math.PI / 2;
    this.settle(line, -5.2, 1, lineY);
    g.add(line);
    const pelikat = cloth(1.1, 1.3, plaidTexture(3));
    const pelikat2 = cloth(1.0, 1.2, plaidTexture(4));
    const batik = cloth(1.3, 1.2, batikTexture(5));
    pelikat.rotation.y = Math.PI / 2;
    pelikat2.rotation.y = Math.PI / 2;
    batik.rotation.y = Math.PI / 2;
    this.settle(pelikat, -5.2, -0.6, lineY);
    this.settle(pelikat2, -5.2, 2.6, lineY);
    this.settle(batik, -5.2, 1.0, lineY);
    g.add(pelikat, pelikat2, batik);

    // bunga raya hedge and a rambutan tree
    for (const x of [-4, 4]) {
      const hedge = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const bush = sphere(0.55, '#3f7a35', 7);
        bush.position.set(i * 0.7 - 1.05, 0.5, 0);
        bush.scale.set(1, 0.9, 1);
        hedge.add(bush);
        for (let k = 0; k < 3; k++) {
          const flower = sphere(0.07, '#d8262f', 6);
          flower.position.set(i * 0.7 - 1.05 + (Math.random() - 0.5) * 0.7, 0.55 + (Math.random() - 0.3) * 0.5, (Math.random() - 0.5) * 0.7);
          hedge.add(flower);
        }
      }
      this.settle(hedge, x, 4.6);
      hedge.rotation.y = Math.PI / 2;
      g.add(hedge);
    }
    const rambutan = new THREE.Group();
    const trunk = cyl(0.14, 0.2, 2.6, 7, '#5a3e2a');
    trunk.position.y = 1.3;
    const canopy = sphere(2.0, '#3f7a35', 8);
    canopy.position.y = 3.6;
    canopy.scale.set(1.2, 0.9, 1.2);
    rambutan.add(trunk, canopy);
    for (let i = 0; i < 24; i++) {
      const fruit = sphere(0.09, '#d8302f', 5);
      const a = Math.random() * Math.PI * 2;
      const r = 1.2 + Math.random() * 1.0;
      fruit.position.set(Math.cos(a) * r, 3.0 + Math.random() * 1.2, Math.sin(a) * r);
      rambutan.add(fruit);
    }
    this.settle(rambutan, 6.5, 6.5);
    g.add(rambutan);

    // ---------------- tempayan at the foot of the stairs
    const tempayan = new THREE.Group();
    const jar = lathe(
      [
        [0, 0],
        [0.26, 0.0],
        [0.36, 0.22],
        [0.34, 0.48],
        [0.26, 0.6],
        [0.28, 0.64],
        [0.24, 0.64],
        [0.22, 0.58],
      ],
      16,
      '#8a4a2e',
      { roughness: 0.7 },
    );
    const waterMat = this.ctx.water.track(makeWaterMaterial({ scale: 2.5, opacity: 0.9 }));
    this.tempayanWater = new THREE.Mesh(new THREE.CircleGeometry(0.22, 18), waterMat);
    this.tempayanWater.rotation.x = -Math.PI / 2;
    this.tempayanWater.position.y = 0.55;
    this.gayung = new THREE.Group();
    const scoop = lathe(
      [
        [0, 0],
        [0.07, 0],
        [0.075, 0.08],
        [0.07, 0.085],
        [0.06, 0.08],
        [0.06, 0.01],
      ],
      12,
      '#3a6ab0',
    );
    const handle = box(0.03, 0.02, 0.3, '#3a6ab0');
    handle.position.set(0, 0.07, 0.17);
    this.gayung.add(scoop, handle);
    this.gayung.position.set(0.1, 0.66, -0.1);
    this.gayung.rotation.set(0.15, 0.8, 0.25);
    tempayan.add(jar, this.tempayanWater, this.gayung);
    this.settle(tempayan, -2.6, 2.3);
    g.add(tempayan);
    this.pourEmitter = new Emitter({
      count: 60,
      color: '#dfeeff',
      size: 0.08,
      life: [0.5, 0.8],
      spawn: () => {
        const p = this.gayung.getWorldPosition(new THREE.Vector3());
        p.y -= 0.02;
        p.x += (Math.random() - 0.5) * 0.06;
        return this.group.worldToLocal(p);
      },
      velocity: () => new THREE.Vector3((Math.random() - 0.5) * 0.2 - 0.3, -0.4, (Math.random() - 0.5) * 0.2 - 0.6),
      gravity: -3.5,
      opacity: 0.8,
    });
    g.add(this.pourEmitter.points);
    this.add({
      id: 'rumah-tempayan',
      object: tempayan,
      gestures: ['hold'],
      hint: 'Hold to pour water over your feet',
      markerOffset: new THREE.Vector3(0, 0.3, 0),
      onHoldStart: () => {
        this.pouring = true;
        this.pourTime = 0;
        this.ctx.synth.pour(1.6);
      },
      onHoldEnd: (ms) => {
        this.pouring = false;
        if (ms > 900) {
          this.memory('tempayan');
          this.ctx.music.play('gamelan', 7, 0.5);
        }
      },
    });

    // ---------------- gerai with nasi lemak bungkus, across the path
    const gerai = new THREE.Group();
    const table = box(1.5, 0.05, 0.8, '#8a6a3a');
    table.position.y = 0.8;
    for (const [x, z] of [
      [-0.65, -0.3],
      [0.65, -0.3],
      [-0.65, 0.3],
      [0.65, 0.3],
    ]) {
      const leg = cyl(0.03, 0.03, 0.8, 6, '#6e4a2c');
      leg.position.set(x, 0.4, z);
      gerai.add(leg);
    }
    const clothTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.02, 0.9), mat('#2b3a7a', { map: batikTexture(6) }));
    clothTop.position.y = 0.835;
    const drape = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), mat('#2b3a7a', { map: batikTexture(6), side: THREE.DoubleSide }));
    drape.position.set(0, 0.6, -0.45);
    gerai.add(table, clothTop, drape);
    const tray = box(0.7, 0.03, 0.45, '#c9a86a', { map: weaveTexture() });
    tray.position.set(-0.2, 0.86, 0);
    gerai.add(tray);
    const paper = paperTexture();
    const stack = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const b = cone(0.095, 0.1, 3, '#b8935f', { map: paper });
      b.position.set(-0.25 + (i % 3) * 0.2, 0.93, -0.12 + Math.floor(i / 3) * 0.14);
      b.rotation.y = Math.random() * Math.PI;
      stack.add(b);
    }
    gerai.add(stack);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshStandardMaterial({ map: signTexture('RM1'), roughness: 1 }));
    sign.position.set(0.45, 0.95, -0.1);
    sign.rotation.x = -0.5;
    gerai.add(sign);
    const bag = sphere(0.1, '#f0e6d6', 6);
    bag.scale.set(1, 1.3, 1);
    bag.position.set(0.5, 0.95, 0.2);
    gerai.add(bag);
    // a small awning over the stall
    const awning = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.03, 1.2), mat('#c9d3d8', { map: zinc, side: THREE.DoubleSide }));
    awning.position.set(0, 1.95, 0);
    awning.rotation.x = 0.12;
    for (const x of [-0.85, 0.85]) {
      const post = cyl(0.025, 0.025, 1.95, 6, '#6e4a2c');
      post.position.set(x, 0.975, 0.5);
      gerai.add(post);
    }
    gerai.add(awning);
    this.settle(gerai, 3.4, -2.6);
    gerai.rotation.y = 0.35;
    g.add(gerai);
    this.add({
      id: 'rumah-gerai',
      object: stack,
      gestures: ['tap'],
      hint: 'Tap to take a nasi lemak bungkus (RM1)',
      markerSize: 0.4,
      enabled: () => !this.ctx.hands.active,
      onTap: () => this.takeBungkus(),
    });

    // ---------------- congkak on the anjung
    const congkak = new THREE.Group();
    const board = box(0.95, 0.06, 0.24, '#8a5a3a', { map: darkWood });
    congkak.add(board);
    const holeMat = mat('#3a2416');
    const seedMat = mat('#e8dcc4', { roughness: 0.4 });
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 7; i++) {
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 10), holeMat);
        h.position.set(-0.33 + i * 0.11, 0.028, side === 0 ? -0.06 : 0.06);
        congkak.add(h);
        for (let k = 0; k < 4; k++) {
          const seed = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 4), seedMat);
          seed.position.set(h.position.x + (Math.random() - 0.5) * 0.03, 0.04, h.position.z + (Math.random() - 0.5) * 0.03);
          congkak.add(seed);
          this.congkakSeeds.push(seed);
        }
      }
    }
    for (const x of [-0.44, 0.44]) {
      const store = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 12), holeMat);
      store.position.set(x, 0.028, 0);
      congkak.add(store);
    }
    congkak.position.set(1.2, floorY + 0.09, 8 - 3.5);
    congkak.rotation.y = 0.2;
    g.add(congkak);
    this.add({
      id: 'rumah-congkak',
      object: congkak,
      gestures: ['tap'],
      hint: 'Tap a house to sow the seeds',
      markerSize: 0.3,
      enabled: () => !this.sowing && !this.ctx.hands.active,
      onTap: () => this.sow(),
    });

    this.add({
      id: 'rumah-radio',
      object: radio,
      gestures: ['tap'],
      hint: 'Tap the radio',
      markerSize: 0.26,
      range: 8,
      enabled: () => !this.ctx.hands.active,
      onTap: () => {
        this.ctx.music.phrase('radio', 1.2, 5);
        this.memory('radio');
      },
    });

    // anjung seat, looking out over the lake
    const seatSpot = new THREE.Object3D();
    seatSpot.position.set(-0.4, floorY + 0.4, 8 - 3.6);
    const seatMarker = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 12), mat('#c9a86a', { map: weaveTexture() }));
    seatMarker.position.copy(seatSpot.position);
    g.add(seatMarker);
    this.addSeat('anjung', seatMarker, new THREE.Vector3(-0.4, floorY + 1.15, 8 - 3.6), new THREE.Vector3(-0.4, 0, -30), 'Tap to sit on the anjung', () => {
      if (this.ending && !this.loopRequested) {
        this.loopRequested = true;
        window.setTimeout(() => {
          this.ctx.ui.toast('Dawn is coming round again.', 6000);
          this.ctx.newLoop();
          this.ending = false;
          this.resetPelita();
        }, 5000);
      }
    });

    // ---------------- the pelita path from the jetty to the house
    const path = this.ctx.path;
    const uHome = path.stationU.rumah;
    const spacing = 1.25 / path.length;
    for (let i = 0; i < 8; i++) {
      const u = uHome - spacing * (i + 1.6);
      const p = path.getPoint(u, new THREE.Vector3());
      const tan = path.getTangent(u, new THREE.Vector3());
      const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const pos = p.clone().add(side.multiplyScalar(i % 2 === 0 ? 0.95 : -0.95));
      pos.y = this.ctx.terrain.height(pos.x, pos.z);
      const stake = new THREE.Group();
      const bamboo = cyl(0.02, 0.025, 1.0, 6, '#c9b07a');
      bamboo.position.y = 0.5;
      const tin = cyl(0.05, 0.045, 0.09, 10, '#b0b4b8', { metalness: 0.4, roughness: 0.5 });
      tin.position.y = 1.04;
      const wick = cyl(0.006, 0.006, 0.05, 4, '#333333');
      wick.position.y = 1.1;
      const flame = flameSprite(0.22);
      flame.position.y = 1.2;
      const glow = glowSprite('#ffb060', 1.6, 0);
      glow.position.y = 1.15;
      stake.add(bamboo, tin, wick, flame, glow);
      stake.position.copy(pos);
      this.ctx.scene.add(stake);
      const pel: Pelita = { flame, glow, lit: false, pos: pos.clone().add(new THREE.Vector3(0, 1.15, 0)) };
      this.pelita.push(pel);
      this.add({
        id: `rumah-pelita-${i}`,
        object: stake,
        gestures: ['tap'],
        hint: 'Tap to light the pelita',
        markerSize: 0.3,
        range: 6,
        enabled: () => this.returnMode && !pel.lit,
        onTap: () => this.lightPelita(pel, i),
      });
    }
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight('#ffb060', 0, 7, 1.8);
      this.ctx.scene.add(l);
      this.pelitaLights.push(l);
    }
  }

  private resetPelita() {
    for (const p of this.pelita) {
      p.lit = false;
      (p.flame.material as THREE.SpriteMaterial).opacity = 0;
      (p.glow.material as THREE.SpriteMaterial).opacity = 0;
    }
    for (const l of this.pelitaLights) l.intensity = 0;
    this.houseLight.intensity = 0;
    (this.houseLamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
    this.loopRequested = false;
  }

  private lightPelita(p: Pelita, i: number) {
    p.lit = true;
    this.ctx.synth.match();
    this.ctx.music.play('gamelan', 5 + (i % 5), 0.45);
    haptic(6);
    const light = this.pelitaLights[i % 2];
    light.position.copy(p.pos);
    light.intensity = 2.2;
    const litCount = this.pelita.filter((q) => q.lit).length;
    if (litCount === this.pelita.length) {
      window.setTimeout(() => {
        this.houseLight.intensity = 6;
        (this.houseLamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.5;
        this.ctx.synth.chime(392, 587);
        this.memory('pelita');
        this.ending = true;
        window.setTimeout(() => this.ctx.ui.toast(ENDING_TEXT, 14000), 7000);
      }, 900);
    }
  }

  // ---------------------------------------------------------------- nasi lemak

  private takeBungkus() {
    const { root, stages, reveal } = this.buildBungkus();
    this.revealed = false;
    this.unwrap = new Unwrap(this.ctx.camera, stages, {
      idPrefix: 'bungkus',
      onComplete: () => {
        reveal();
        this.revealed = true;
        this.steam.rate = 14;
        this.ctx.synth.leaf(0.6);
        window.setTimeout(() => this.ctx.music.play('gamelan', 9, 0.6), 250);
        window.setTimeout(() => this.memory('nasilemak'), 900);
      },
    });
    for (const it of this.unwrap.interactables) this.ctx.interaction.register(it);
    const finishHint: import('../core/Interaction').Interactable = {
      id: 'bungkus-done',
      object: root,
      gestures: [],
      hint: 'Swipe down, or tap \u2715, to set it down',
      enabled: () => this.revealed,
    };
    this.ctx.interaction.register(finishHint);
    this.ctx.synth.crinkle(0.7);
    this.ctx.hands.open(root, [...this.unwrap.interactables, finishHint], {
      onClose: () => {
        for (const it of this.unwrap!.interactables) this.ctx.interaction.unregister(it);
        this.ctx.interaction.unregister(finishHint);
        this.steam.rate = 0;
        if (this.revealed) this.complete();
        this.unwrap = null;
      },
    });
  }

  private buildBungkus() {
    const root = new THREE.Group();
    const s = 0.19;
    const apexH = 0.105;
    const openAngle = Math.PI / 2 + 0.15;

    const paper = mat('#c9a06a', { map: paperTexture(), side: THREE.DoubleSide, flat: false });
    const leaf = mat('#4a8a38', { map: leafTexture(), side: THREE.DoubleSide, flat: false });

    const flapGeo = (side: number, height: number) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([-side / 2, 0, 0, side / 2, 0, 0, 0, height, 0], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
      geo.computeVertexNormals();
      return geo;
    };
    const makeLayer = (side: number, apex: number, material: THREE.Material, y: number) => {
      const inr = side / (2 * Math.sqrt(3));
      const sl = Math.hypot(apex, inr);
      const ph = Math.atan2(apex, inr);
      const closed = -(Math.PI / 2 - ph);
      const hinges: THREE.Object3D[] = [];
      const tips: THREE.Object3D[] = [];
      const pivots: THREE.Object3D[] = [];
      for (let k = 0; k < 3; k++) {
        const a = (k * 2 * Math.PI) / 3 + Math.PI / 3;
        const pivot = new THREE.Object3D();
        pivot.position.set(Math.sin(a) * inr, y, Math.cos(a) * inr);
        pivot.rotation.y = a;
        const hinge = new THREE.Object3D();
        hinge.rotation.x = closed;
        const flap = new THREE.Mesh(flapGeo(side, sl), material);
        flap.castShadow = false;
        const tip = new THREE.Object3D();
        tip.position.set(0, sl, 0);
        hinge.add(flap, tip);
        pivot.add(hinge);
        root.add(pivot);
        hinges.push(hinge);
        tips.push(tip);
        pivots.push(pivot);
      }
      // base triangle
      const base = new THREE.Mesh(new THREE.CircleGeometry(side / Math.sqrt(3), 3), material);
      base.rotation.x = -Math.PI / 2;
      base.rotation.z = Math.PI / 6;
      base.position.y = y;
      root.add(base);
      return { hinges, tips, pivots, closed };
    };

    const paperLayer = makeLayer(s, apexH, paper, 0);
    const leafLayer = makeLayer(s * 0.84, apexH * 0.86, leaf, 0.004);

    // rubber band (with a fatter invisible proxy so it is easy to catch with a thumb)
    const band = new THREE.Group();
    const bandMesh = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.004, 6, 24), mat('#d9b04a', { roughness: 0.6 }));
    bandMesh.rotation.x = Math.PI / 2;
    const bandProxy = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.022, 6, 24), mat('#000000'));
    bandProxy.rotation.x = Math.PI / 2;
    bandProxy.visible = false;
    band.add(bandMesh, bandProxy);
    band.position.y = 0.05;
    root.add(band);

    // rice and toppings, hidden until the leaf opens
    const food = new THREE.Group();
    const rice = new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#f6efe2', { roughness: 0.8 }));
    rice.scale.set(1, 0.72, 1);
    const sambal = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 7), mat('#b8321f', { roughness: 0.35 }));
    sambal.scale.set(1.3, 0.55, 1);
    sambal.position.set(0.025, 0.038, 0.02);
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 7), mat('#fbf6ee', { roughness: 0.5 }));
    egg.scale.set(1, 0.55, 1.3);
    egg.position.set(-0.028, 0.035, 0.012);
    const yolk = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.004, 10), mat('#f2b632', { roughness: 0.5 }));
    yolk.position.set(-0.028, 0.048, 0.012);
    food.add(rice, sambal, egg, yolk);
    for (let i = 0; i < 2; i++) {
      const cuc = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.003, 12), mat('#8fc46a', { roughness: 0.6 }));
      cuc.position.set(-0.005 + i * 0.02, 0.041 + i * 0.003, -0.035);
      cuc.rotation.x = 0.3;
      food.add(cuc);
    }
    for (let i = 0; i < 6; i++) {
      const bilis = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.003, 0.004), mat('#c0c4c8', { roughness: 0.5, metalness: 0.2 }));
      bilis.position.set(0.02 + (Math.random() - 0.5) * 0.04, 0.058, 0.02 + (Math.random() - 0.5) * 0.04);
      bilis.rotation.y = Math.random() * Math.PI;
      food.add(bilis);
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 6, 4), mat('#8a5a2a'));
      nut.position.set(0.03 + (Math.random() - 0.5) * 0.04, 0.056, 0.02 + (Math.random() - 0.5) * 0.04);
      food.add(nut);
    }
    food.position.y = 0.006;
    food.visible = false;
    root.add(food);

    // steam, in the object's own space so it rides along in the hands
    this.steam = new Emitter({
      count: 50,
      color: '#ffffff',
      size: 0.05,
      life: [0.9, 1.6],
      spawn: () => new THREE.Vector3((Math.random() - 0.5) * 0.06, 0.05, (Math.random() - 0.5) * 0.06),
      velocity: () => new THREE.Vector3((Math.random() - 0.5) * 0.02, 0.08 + Math.random() * 0.05, (Math.random() - 0.5) * 0.02),
      opacity: 0.22,
    });
    root.add(this.steam.points);

    const synth = this.ctx.synth;
    const stages: UnwrapStage[] = [];
    stages.push({
      kind: 'flick',
      target: band,
      hint: 'Flick the rubber band off',
      apply: (t) => {
        band.position.y = 0.05 + t * 0.22;
        band.position.x = t * 0.25;
        band.position.z = -t * 0.1;
        band.rotation.z = t * 2.5;
        band.scale.setScalar(1 + t * 0.6);
        band.visible = t < 1;
      },
      onComplete: () => synth.snap(),
    });
    const flapHints = ['Drag a paper flap outward', 'Drag the next flap open', 'And the last one'];
    paperLayer.hinges.forEach((hinge, k) => {
      const flapMesh = hinge.children[0];
      stages.push({
        kind: 'drag',
        target: flapMesh,
        hint: flapHints[k],
        apply: (t) => {
          hinge.rotation.x = THREE.MathUtils.lerp(paperLayer.closed, openAngle, t);
        },
        hinge: () => paperLayer.pivots[k].getWorldPosition(new THREE.Vector3()),
        tip: () => paperLayer.tips[k].getWorldPosition(new THREE.Vector3()),
        onMove: () => synth.crinkle(0.5),
        onComplete: () => synth.crinkle(0.8),
      });
    });
    // the leaf opens as one gesture; an invisible cone over the leaf pyramid catches the drag
    const leafSide = s * 0.84;
    const leafProxy = new THREE.Mesh(new THREE.ConeGeometry((leafSide / Math.sqrt(3)) * 1.15, apexH * 0.86 * 1.15, 3), mat('#000000'));
    leafProxy.position.y = (apexH * 0.86 * 1.15) / 2;
    leafProxy.visible = false;
    root.add(leafProxy);
    stages.push({
      kind: 'drag',
      target: leafProxy,
      hint: 'Drag the banana leaf open',
      apply: (t) => {
        for (const h of leafLayer.hinges) h.rotation.x = THREE.MathUtils.lerp(leafLayer.closed, openAngle - 0.1, t);
        food.visible = t > 0.15;
      },
      hinge: () => leafLayer.pivots[0].getWorldPosition(new THREE.Vector3()),
      tip: () => leafLayer.tips[0].getWorldPosition(new THREE.Vector3()),
      onMove: () => synth.leaf(0.35),
    });
    root.scale.setScalar(1.35);
    return {
      root,
      stages,
      reveal: () => {
        food.visible = true;
      },
    };
  }

  private sow() {
    if (this.sowing) return;
    this.sowing = true;
    this.sows++;
    const seeds = this.congkakSeeds.slice(0, 7 + Math.floor(Math.random() * 6));
    let i = 0;
    const hop = () => {
      if (i >= seeds.length) {
        this.sowing = false;
        if (this.sows >= 3) this.memory('congkak');
        return;
      }
      const seed = seeds[i++];
      const start = seed.position.clone();
      const target = start.clone().add(new THREE.Vector3(0.11 * (i % 2 === 0 ? 1 : -1), 0, (Math.random() - 0.5) * 0.05));
      target.x = THREE.MathUtils.clamp(target.x, -0.4, 0.4);
      const t0 = performance.now();
      const anim = () => {
        const t = Math.min(1, (performance.now() - t0) / 220);
        seed.position.lerpVectors(start, target, t);
        seed.position.y = 0.04 + Math.sin(t * Math.PI) * 0.05;
        if (t < 1) requestAnimationFrame(anim);
      };
      anim();
      this.ctx.synth.cowrie();
      if (i % 3 === 0) this.ctx.music.step('gamelan', 0.3);
      window.setTimeout(hop, 240);
    };
    hop();
  }

  override update(dt: number, time: number) {
    this.time = time;
    this.tickSeat(dt);
    this.unwrap?.update(dt);
    this.steam?.update(dt);
    // tempayan pouring
    if (this.pouring) {
      this.pourTime += dt;
      this.pourEmitter.rate = 45;
      this.gayung.rotation.x = THREE.MathUtils.lerp(this.gayung.rotation.x, 1.6, dt * 6);
      this.gayung.position.y = THREE.MathUtils.lerp(this.gayung.position.y, 0.95, dt * 6);
      this.gayung.position.z = THREE.MathUtils.lerp(this.gayung.position.z, -0.45, dt * 6);
      if (Math.random() < dt * 6) {
        const w = this.gayung.getWorldPosition(new THREE.Vector3());
        this.ctx.ripples.spawn(w.x - 0.3, this.center.y + this.groundAt(-2.6, 2.3) + 0.02, w.z - 0.4, 0.5, 0.9);
      }
    } else {
      this.pourEmitter.rate = 0;
      this.gayung.rotation.x = THREE.MathUtils.lerp(this.gayung.rotation.x, 0.15, dt * 4);
      this.gayung.position.y = THREE.MathUtils.lerp(this.gayung.position.y, 0.66, dt * 4);
      this.gayung.position.z = THREE.MathUtils.lerp(this.gayung.position.z, -0.1, dt * 4);
    }
    this.pourEmitter.update(dt);
    // flames flicker
    for (const p of this.pelita) {
      const fm = p.flame.material as THREE.SpriteMaterial;
      const gm = p.glow.material as THREE.SpriteMaterial;
      const target = p.lit ? 0.9 + Math.sin(time * 17 + p.pos.x) * 0.1 : 0;
      fm.opacity += (target - fm.opacity) * Math.min(1, dt * 6);
      gm.opacity += ((p.lit ? 0.35 : 0) - gm.opacity) * Math.min(1, dt * 3);
      p.flame.scale.set(0.14 + Math.sin(time * 23 + p.pos.z) * 0.01, 0.22 + Math.sin(time * 19) * 0.015, 1);
    }
    // mosquito coil smokes at dusk and night
    const night = this.ctx.time.night;
    this.coilSmoke.rate = this.active && night > 0.3 ? 4 : 0;
    this.coilSmoke.update(dt);
  }
}
