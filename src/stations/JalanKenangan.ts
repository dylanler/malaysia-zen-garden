import * as THREE from 'three';
import { Station } from './Station';
import { box, cyl, sphere, lathe, mat, shadow, flameSprite, glowSprite, cup } from '../world/props';
import { tileTexture, signTexture, plankTexture } from '../world/textures';
import { Emitter } from '../world/Particles';
import type { Interactable } from '../core/Interaction';

const KOLAM_COLORS = ['#f6efe2', '#e53935', '#fdd835', '#43a047', '#8e24aa'];
const LANTERN_COLORS = ['#e53935', '#fb8c00', '#43a047', '#1e88e5', '#ec407a'];
/** Height of the top of the hanging wire above a lantern's centre. */
const LANTERN_WIRE_TOP = 0.375;

export class JalanKenangan extends Station {
  private kolamCanvas!: HTMLCanvasElement;
  private kolamCtx!: CanvasRenderingContext2D;
  private kolamTex!: THREE.CanvasTexture;
  private kolamPlane!: THREE.Mesh;
  private kolamColor = 0;
  private strokes = 0;
  private raycaster = new THREE.Raycaster();
  private bowls: THREE.Mesh[] = [];
  private lamps: { flame: THREE.Sprite; glow: THREE.Sprite; lit: boolean }[] = [];
  private lampLight!: THREE.PointLight;
  private lanterns: THREE.Group[] = [];
  private handLantern: THREE.Group | null = null;
  private handPivot: THREE.Group | null = null;
  private handHolder = new THREE.Group();
  private lanternFlame: THREE.Sprite | null = null;
  private lanternLight: THREE.PointLight | null = null;
  private lanternLit = false;
  private lanternInteractable: Interactable | null = null;
  private eggsCracked = false;
  private eggs: THREE.Mesh[] = [];
  private yolks: THREE.Group | null = null;
  private kopiSteam!: Emitter;
  private putuSteam!: Emitter;
  private streetLights: THREE.PointLight[] = [];
  private bulbs: THREE.Mesh[] = [];
  private shopGlow!: THREE.Mesh;
  private catTail!: THREE.Mesh;

  build() {
    const g = this.group;
    const wood = plankTexture('#8a6a3a', '#5a4020');

    // ---------------- the street and two rows of shophouses
    const road = new THREE.Mesh(new THREE.PlaneGeometry(22, 4.2), mat('#5e5c62', { roughness: 0.95 }));
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.02;
    road.receiveShadow = true;
    g.add(road);
    for (let i = -4; i <= 4; i++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.08), mat('#d9d3c0'));
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(i * 2.4, 0.03, 0);
      g.add(dash);
    }
    const drainMat = mat('#8f8f88');
    for (const z of [-2.15, 2.15]) {
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(22, 0.16, 0.3), drainMat);
      kerb.position.set(0, 0.08, z);
      g.add(kerb);
    }
    this.facade(-3, -1, 'indian');
    this.facade(3.5, -1, 'runcit');
    this.facade(-1.5, 1, 'kopitiam');
    this.facade(5, 1, 'ubat');

    // ---------------- kolam and vilakku at the Indian doorway (lake side)
    this.kolamCanvas = document.createElement('canvas');
    this.kolamCanvas.width = 512;
    this.kolamCanvas.height = 512;
    this.kolamCtx = this.kolamCanvas.getContext('2d')!;
    this.resetKolam();
    this.kolamTex = new THREE.CanvasTexture(this.kolamCanvas);
    this.kolamTex.colorSpace = THREE.SRGBColorSpace;
    this.kolamPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshStandardMaterial({ map: this.kolamTex, transparent: true, roughness: 1 }));
    this.kolamPlane.rotation.x = -Math.PI / 2;
    this.kolamPlane.position.set(-3, 0.19, -3.05);
    this.kolamPlane.renderOrder = 3;
    g.add(this.kolamPlane);
    this.add({
      id: 'jalan-kolam',
      object: this.kolamPlane,
      gestures: ['drag', 'tap'],
      hint: () => `Drag to draw with ${['white', 'red', 'yellow', 'green', 'purple'][this.kolamColor]} rice flour`,
      markerSize: 0.34,
      range: 7,
      onDrag: (_dx, _dy, ndc) => this.paint(ndc),
      onTap: (hit) => {
        if (hit.uv) this.dot(hit.uv.x, hit.uv.y);
      },
    });
    // bowls of coloured flour
    KOLAM_COLORS.forEach((c, i) => {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.07, 12), mat('#c0c4c8', { metalness: 0.5, roughness: 0.4 }));
      bowl.position.set(-4.3 + i * 0.22, 0.2, -2.55);
      const powder = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 12), mat(c, { roughness: 1 }));
      powder.position.set(0, 0.035, 0);
      bowl.add(powder);
      g.add(bowl);
      this.bowls.push(bowl);
      this.add({
        id: `jalan-bowl-${i}`,
        object: bowl,
        gestures: ['tap'],
        hint: `Tap to pick up the ${['white', 'red', 'yellow', 'green', 'purple'][i]} flour`,
        markerSize: 0.16,
        range: 7,
        enabled: () => this.kolamColor !== i,
        onTap: () => {
          this.kolamColor = i;
          this.ctx.synth.cowrie();
          for (const b of this.bowls) b.position.y = 0.2;
          bowl.position.y = 0.26;
        },
      });
    });
    // vilakku along the threshold
    this.lampLight = new THREE.PointLight('#ffb060', 0, 6, 1.8);
    this.lampLight.position.set(-3, 0.6, -3.7);
    g.add(this.lampLight);
    for (let i = 0; i < 5; i++) {
      const lamp = lathe(
        [
          [0, 0],
          [0.06, 0],
          [0.05, 0.02],
          [0.02, 0.03],
          [0.02, 0.12],
          [0.05, 0.13],
          [0.06, 0.16],
          [0.03, 0.16],
        ],
        12,
        '#c9962a',
        { metalness: 0.7, roughness: 0.35, flat: false },
      );
      lamp.position.set(-4.0 + i * 0.5, 0.16, -3.75);
      const flame = flameSprite(0.14);
      flame.position.set(0, 0.22, 0);
      const glow = glowSprite('#ffb060', 0.9, 0);
      glow.position.set(0, 0.2, 0);
      lamp.add(flame, glow);
      g.add(lamp);
      const entry = { flame, glow, lit: false };
      this.lamps.push(entry);
      this.add({
        id: `jalan-vilakku-${i}`,
        object: lamp,
        gestures: ['tap'],
        hint: 'Tap to light the vilakku',
        markerSize: 0.18,
        range: 7,
        enabled: () => !entry.lit,
        onTap: () => {
          entry.lit = true;
          this.ctx.synth.match();
          this.ctx.music.play('veena', 5 + i, 0.55);
          const lit = this.lamps.filter((l) => l.lit).length;
          this.lampLight.intensity = 0.8 + lit * 0.7;
          if (lit >= 2) this.memory('vilakku');
          this.checkKolamComplete();
        },
      });
    }

    // ---------------- kopitiam: marble tables, half-boiled eggs, lanterns
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 20), mat('#e8e6e0', { roughness: 0.3, flat: false }));
    tableTop.position.set(-1.2, 0.76, 3.0);
    const tableLeg = cyl(0.05, 0.08, 0.74, 8, '#3f2a18');
    tableLeg.position.set(-1.2, 0.37, 3.0);
    g.add(tableTop, tableLeg);
    for (const [x, z] of [
      [-1.9, 3.0],
      [-1.2, 2.35],
    ]) {
      const chair = new THREE.Group();
      const seat = box(0.4, 0.04, 0.4, '#5a3d26', { map: wood });
      seat.position.y = 0.45;
      const back = box(0.4, 0.45, 0.04, '#5a3d26', { map: wood });
      back.position.set(0, 0.7, -0.18);
      chair.add(seat, back);
      for (const [lx, lz] of [
        [-0.17, -0.17],
        [0.17, -0.17],
        [-0.17, 0.17],
        [0.17, 0.17],
      ]) {
        const leg = cyl(0.02, 0.02, 0.45, 6, '#3f2a18');
        leg.position.set(lx, 0.225, lz);
        chair.add(leg);
      }
      chair.position.set(x, 0.16, z);
      chair.lookAt(new THREE.Vector3(-1.2, 0.16, 3.0));
      g.add(chair);
    }
    const bowl = lathe(
      [
        [0, 0],
        [0.07, 0],
        [0.12, 0.05],
        [0.13, 0.06],
        [0.11, 0.06],
      ],
      14,
      '#f6efe2',
      { roughness: 0.3, flat: false },
    );
    bowl.position.set(-1.05, 0.78, 3.05);
    g.add(bowl);
    for (let i = 0; i < 2; i++) {
      const egg = sphere(0.035, '#f2dcc0', 8, { flat: false, roughness: 0.6 });
      egg.scale.set(1, 1.3, 1);
      egg.position.set(-1.05 + (i - 0.5) * 0.05, 0.83, 3.05 + (i - 0.5) * 0.03);
      egg.rotation.z = (i - 0.5) * 0.6;
      g.add(egg);
      this.eggs.push(egg);
    }
    const soy = cyl(0.025, 0.025, 0.14, 8, '#2a1a12');
    soy.position.set(-1.35, 0.85, 3.2);
    const soyCap = cyl(0.015, 0.02, 0.03, 8, '#d8262f');
    soyCap.position.set(-1.35, 0.935, 3.2);
    const pepper = cyl(0.02, 0.02, 0.06, 8, '#f6efe2');
    pepper.position.set(-1.42, 0.81, 3.05);
    const kopi = cup('#f6efe2', 0.04, 0.06);
    kopi.position.set(-1.3, 0.78, 2.75);
    const paper = box(0.3, 0.015, 0.2, '#e8e2d2');
    paper.position.set(-0.85, 0.79, 2.75);
    paper.rotation.y = 0.4;
    g.add(soy, soyCap, pepper, kopi, paper);
    this.kopiSteam = new Emitter({
      count: 20,
      color: '#ffffff',
      size: 0.12,
      life: [0.8, 1.4],
      spawn: () => new THREE.Vector3(-1.3, 0.85, 2.75),
      velocity: () => new THREE.Vector3((Math.random() - 0.5) * 0.03, 0.12, (Math.random() - 0.5) * 0.03),
      opacity: 0.18,
    });
    this.kopiSteam.rate = 4;
    g.add(this.kopiSteam.points);
    const eggProxy = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.2, 10), mat('#000000'));
    eggProxy.visible = false;
    eggProxy.position.set(-1.05, 0.85, 3.05);
    g.add(eggProxy);
    this.add({
      id: 'jalan-eggs',
      object: eggProxy,
      gestures: ['tap'],
      hint: 'Tap to crack the eggs into the bowl',
      markerSize: 0.22,
      range: 7,
      enabled: () => !this.eggsCracked,
      onTap: () => this.crackEggs(),
    });
    // the counter at the back with a kettle
    const counter = box(3.2, 0.9, 0.6, '#5a3d26', { map: wood });
    counter.position.set(-1.5, 0.61, 3.75);
    const counterTop = box(3.3, 0.05, 0.7, '#e8e6e0', { roughness: 0.3 });
    counterTop.position.set(-1.5, 1.08, 3.75);
    g.add(counter, counterTop);
    const kettle = lathe(
      [
        [0, 0],
        [0.13, 0],
        [0.15, 0.12],
        [0.1, 0.22],
        [0.04, 0.24],
      ],
      12,
      '#c0c4c8',
      { metalness: 0.7, roughness: 0.3, flat: false },
    );
    kettle.position.set(-2.4, 1.11, 3.75);
    g.add(kettle);
    for (let i = 0; i < 4; i++) {
      const c = cup('#f6efe2', 0.04, 0.06);
      c.position.set(-1.6 + i * 0.12, 1.11, 3.8);
      g.add(c);
    }
    // interior glow at night
    this.shopGlow = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.4), new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0 }));
    this.shopGlow.position.set(-1.5, 1.5, 3.97);
    this.shopGlow.rotation.y = Math.PI;
    g.add(this.shopGlow);

    // cellophane lanterns hanging under the awning
    LANTERN_COLORS.forEach((c, i) => {
      const lantern = this.buildLantern(c);
      lantern.position.set(-2.6 + i * 0.7, 2.25, 2.3);
      g.add(lantern);
      this.lanterns.push(lantern);
      this.add({
        id: `jalan-lantern-${i}`,
        object: lantern,
        gestures: ['tap'],
        hint: 'Tap to take a lantern',
        markerSize: 0.22,
        range: 7,
        enabled: () => lantern.visible && !this.handLantern,
        onTap: () => this.takeLantern(lantern, c),
      });
    });
    // the holder sits at the tip of the carrying stick, where the lantern's wire hangs from
    this.ctx.camera.add(this.handHolder);
    this.handHolder.position.set(0.22, -0.1, -0.78);

    // ---------------- putu bambu cart at the end of the street
    const cart = new THREE.Group();
    const body = box(1.0, 0.7, 0.6, '#3a6ab0');
    body.position.y = 0.75;
    const steamBox = box(0.5, 0.25, 0.4, '#c0c4c8', { metalness: 0.5, roughness: 0.4 });
    steamBox.position.set(-0.15, 1.22, 0);
    const pipe = cyl(0.02, 0.02, 0.3, 6, '#888888');
    pipe.position.set(0.05, 1.5, 0);
    for (let i = 0; i < 6; i++) {
      const tube = cyl(0.025, 0.025, 0.14, 6, '#d9c48a');
      tube.position.set(0.2 + (i % 3) * 0.08, 1.17 + Math.floor(i / 3) * 0.06, -0.05 + (i % 2) * 0.1);
      tube.rotation.z = Math.PI / 2;
      cart.add(tube);
    }
    for (const x of [-0.35, 0.35]) {
      const wheel = cyl(0.25, 0.25, 0.06, 12, '#222222');
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.25, 0.35);
      cart.add(wheel);
    }
    const umbrella = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.35, 10), mat('#d8262f', { side: THREE.DoubleSide }));
    umbrella.position.y = 2.2;
    const umbPole = cyl(0.02, 0.02, 1.2, 6, '#888888');
    umbPole.position.set(0, 1.6, 0.2);
    cart.add(body, steamBox, pipe, umbrella, umbPole);
    cart.position.set(8.5, 0.02, -2.9);
    cart.rotation.y = 0.4;
    g.add(cart);
    this.putuSteam = new Emitter({
      count: 40,
      color: '#ffffff',
      size: 0.3,
      life: [1.2, 2.2],
      spawn: () => new THREE.Vector3(8.5, 1.7, -2.9),
      velocity: () => new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.35, (Math.random() - 0.5) * 0.08),
      opacity: 0.2,
    });
    this.putuSteam.rate = 7;
    g.add(this.putuSteam.points);
    const cartProxy = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.8), mat('#000000'));
    cartProxy.visible = false;
    cartProxy.position.set(8.5, 0.8, -2.9);
    g.add(cartProxy);
    this.add({
      id: 'jalan-putu',
      object: cartProxy,
      gestures: ['tap'],
      hint: 'Tap the putu bambu cart',
      markerSize: 0.3,
      range: 8,
      onTap: () => {
        this.ctx.synth.whistle(1.2);
        this.putuSteam.burst(20);
        this.memory('putu');
      },
    });

    // ---------------- street lamps
    for (const [x, z] of [
      [-6.5, 2.1],
      [6.5, -2.1],
    ]) {
      const pole = cyl(0.05, 0.07, 3.6, 8, '#3a3a3a');
      pole.position.set(x, 1.8, z);
      const arm = box(0.8, 0.05, 0.05, '#3a3a3a');
      arm.position.set(x - Math.sign(z) * 0.0, 3.55, z - Math.sign(z) * 0.4);
      arm.rotation.y = Math.PI / 2;
      const bulb = sphere(0.09, '#fff2cc', 8, { emissive: '#fff2cc', emissiveIntensity: 0 });
      bulb.position.set(x, 3.5, z - Math.sign(z) * 0.8);
      const light = new THREE.PointLight('#ffe0a0', 0, 12, 1.6);
      light.position.copy(bulb.position);
      g.add(pole, arm, bulb, light);
      this.streetLights.push(light);
      this.bulbs.push(bulb);
    }

    // a cat asleep on the rice sacks
    const cat = new THREE.Group();
    const catBody = sphere(0.14, '#e08a3a', 8);
    catBody.scale.set(1.4, 0.7, 1);
    const catHead = sphere(0.08, '#e08a3a', 8);
    catHead.position.set(0.16, 0.06, 0.02);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.05, 4), mat('#e08a3a'));
      ear.position.set(0.18, 0.13, s * 0.04);
      cat.add(ear);
    }
    this.catTail = cyl(0.015, 0.02, 0.3, 5, '#e08a3a');
    this.catTail.rotation.z = Math.PI / 2 + 0.3;
    this.catTail.position.set(-0.22, 0.02, 0.06);
    cat.add(catBody, catHead, this.catTail);
    cat.position.set(2.6, 0.65, -2.7);
    cat.rotation.y = 0.5;
    g.add(cat);
  }

  private facade(x: number, side: number, kind: 'indian' | 'runcit' | 'kopitiam' | 'ubat') {
    const g = this.group;
    const z = side * 4.2;
    const width = 6.4;
    const colors: Record<string, string> = { indian: '#e0c070', runcit: '#8fbf9f', kopitiam: '#d9c9a3', ubat: '#c98a7a' };
    const col = colors[kind];
    const shop = new THREE.Group();
    // five-foot way floor
    const walk = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, 2.2), mat('#e8e0d0', { map: tileTexture(kind === 'indian' ? 0 : 1) }));
    walk.position.set(0, 0.08, -side * 1.1);
    walk.receiveShadow = true;
    shop.add(walk);
    // ground floor back wall (the shop front), with an opening
    const wallMat = mat(col, { roughness: 0.9 });
    const gf = new THREE.Mesh(new THREE.BoxGeometry(width, 3.0, 0.2), wallMat);
    gf.position.set(0, 1.5, 0.1 * side);
    shadow(gf);
    shop.add(gf);
    const openingW = kind === 'kopitiam' ? 3.6 : kind === 'indian' ? 1.4 : 3.0;
    const opening = new THREE.Mesh(new THREE.BoxGeometry(openingW, 2.4, 0.26), mat(kind === 'indian' ? '#5a3a22' : '#141820'));
    opening.position.set(kind === 'indian' ? 0 : 0.3, 1.2, 0.08 * side);
    shop.add(opening);
    if (kind === 'runcit' || kind === 'ubat') {
      for (let i = 0; i < 12; i++) {
        const bar = box(0.04, 2.4, 0.04, '#2a2a2a');
        bar.position.set(0.3 - openingW / 2 + (i / 11) * openingW, 1.2, -0.12 * side);
        shop.add(bar);
      }
    }
    // upper floor overhanging the walkway
    const uf = new THREE.Mesh(new THREE.BoxGeometry(width, 2.6, 2.6), wallMat);
    uf.position.set(0, 4.3, -side * 1.0);
    shadow(uf);
    shop.add(uf);
    for (let i = 0; i < 2; i++) {
      const win = box(1.0, 1.4, 0.06, '#1f2a44');
      win.position.set(-1.5 + i * 3, 4.3, -side * 2.32);
      shop.add(win);
      for (let k = 0; k < 6; k++) {
        const lv = box(1.02, 0.05, 0.1, '#e8dcc4');
        lv.position.set(-1.5 + i * 3, 3.7 + k * 0.24, -side * 2.34);
        lv.rotation.x = 0.5 * side;
        shop.add(lv);
      }
    }
    // roof: pitched clay tiles
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 0.12, 3.2), mat('#8a4a3a'));
    roof.position.set(0, 5.75, -side * 0.9);
    roof.rotation.x = 0.28 * side;
    shadow(roof);
    shop.add(roof);
    // columns along the walkway edge
    for (const cx of [-width / 2 + 0.2, width / 2 - 0.2]) {
      const colm = new THREE.Mesh(new THREE.BoxGeometry(0.38, 3.0, 0.38), mat('#f0e8dc'));
      colm.position.set(cx, 1.5, -side * 2.2);
      shadow(colm);
      shop.add(colm);
    }
    // signboard
    const text = kind === 'kopitiam' ? 'KOPITIAM' : kind === 'runcit' ? 'KEDAI RUNCIT' : kind === 'ubat' ? 'KEDAI UBAT' : 'No. 12';
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(kind === 'indian' ? 0.6 : 2.6, kind === 'indian' ? 0.3 : 0.7), new THREE.MeshStandardMaterial({ map: signTexture(text, kind === 'kopitiam' ? '#2b3a7a' : '#d9c9a3', kind === 'kopitiam' ? '#f6efe2' : '#3a2a1a'), roughness: 0.8 }));
    sign.position.set(kind === 'indian' ? 1.2 : 0, kind === 'indian' ? 2.3 : 3.15, -side * 2.4);
    sign.rotation.y = side > 0 ? Math.PI : 0;
    shop.add(sign);
    if (kind === 'indian') {
      // mango-leaf thoranam over the door and a jasmine garland on the handle
      for (let i = 0; i < 9; i++) {
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.2), mat('#3f7a35', { side: THREE.DoubleSide, flat: false }));
        leaf.position.set(-0.8 + i * 0.2, 2.45 - Math.sin((i / 8) * Math.PI) * 0.12, -side * 0.2);
        leaf.rotation.z = (Math.random() - 0.5) * 0.4;
        shop.add(leaf);
      }
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.8, 4), mat('#d9c48a'));
      string.rotation.z = Math.PI / 2;
      string.position.set(0, 2.55, -side * 0.2);
      shop.add(string);
      for (let i = 0; i < 14; i++) {
        const j = sphere(0.02, '#f6efe2', 5);
        j.position.set(0.55 + Math.sin(i * 0.6) * 0.03, 1.3 - i * 0.035, -side * 0.2);
        shop.add(j);
      }
      // brass pot with water and a plant
      const pot = lathe(
        [
          [0, 0],
          [0.12, 0],
          [0.16, 0.12],
          [0.12, 0.24],
          [0.14, 0.26],
        ],
        12,
        '#c9962a',
        { metalness: 0.6, roughness: 0.4, flat: false },
      );
      pot.position.set(-1.8, 0.16, -side * 1.6);
      shop.add(pot);
    }
    if (kind === 'runcit') {
      for (let i = 0; i < 3; i++) {
        const sack = sphere(0.32, '#d9c9a3', 8);
        sack.scale.set(1, 0.6, 0.8);
        sack.position.set(-1.2 + i * 0.7, 0.35, -side * 1.5);
        shop.add(sack);
      }
    }
    if (kind === 'ubat') {
      for (let i = 0; i < 5; i++) {
        const jar = cyl(0.08, 0.08, 0.22, 10, '#c9e0e8', { transparent: true, opacity: 0.6, roughness: 0.2 });
        jar.position.set(-1.6 + i * 0.35, 1.3 + (i % 2) * 0.3, -side * 0.0);
        shop.add(jar);
      }
    }
    shop.position.set(x, 0, z);
    g.add(shop);
  }

  private buildLantern(color: string) {
    const lantern = new THREE.Group();
    const skin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.26, 12, 1, true),
      new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.3, emissive: color, emissiveIntensity: 0 }),
    );
    const ringTop = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.006, 6, 16), mat('#555555'));
    ringTop.rotation.x = Math.PI / 2;
    ringTop.position.y = 0.13;
    const ringBot = ringTop.clone();
    ringBot.position.y = -0.13;
    const candle = cyl(0.012, 0.012, 0.08, 6, '#f6efe2');
    candle.position.y = -0.09;
    const wire = cyl(0.004, 0.004, 0.25, 4, '#555555');
    wire.position.y = 0.25;
    lantern.add(skin, ringTop, ringBot, candle, wire);
    lantern.userData.skin = skin;
    return lantern;
  }

  private takeLantern(lantern: THREE.Group, color: string) {
    lantern.visible = false;
    const mine = this.buildLantern(color);
    // hang the lantern from the holder origin so it swings from the top of its wire
    mine.position.y = -LANTERN_WIRE_TOP;
    const pivot = new THREE.Group();
    pivot.scale.setScalar(0.6);
    pivot.add(mine);
    // a short bamboo stick runs from the holder back toward the hand at the lower right of the view
    const toHand = new THREE.Vector3(0.14, -0.36, 0.42);
    const stick = cyl(0.009, 0.011, toHand.length(), 6, '#a88a5c');
    stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toHand.clone().normalize());
    stick.position.copy(toHand).multiplyScalar(0.5);
    this.handHolder.add(pivot, stick);
    this.handLantern = mine;
    this.handPivot = pivot;
    this.ctx.synth.crinkle(0.4);
    this.lanternInteractable = this.add({
      id: 'jalan-hand-lantern',
      object: this.handHolder,
      gestures: ['hold'],
      hint: 'Hold the match to the wick',
      range: 3,
      markerSize: 0.22,
      enabled: () => !this.lanternLit,
      onHoldStart: () => this.ctx.synth.match(),
      onHoldEnd: (ms) => {
        if (ms > 700) this.lightLantern();
      },
    });
  }

  private lightLantern() {
    if (!this.handLantern || this.lanternLit) return;
    this.lanternLit = true;
    const skin = this.handLantern.userData.skin as THREE.Mesh;
    (skin.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.9;
    this.lanternFlame = flameSprite(0.12);
    this.lanternFlame.position.y = -0.03;
    this.handLantern.add(this.lanternFlame);
    this.lanternLight = new THREE.PointLight((skin.material as THREE.MeshStandardMaterial).color, 3.5, 9, 1.5);
    this.lanternLight.position.set(0, 0.05, 0);
    this.handLantern.add(this.lanternLight);
    this.ctx.synth.flameOn();
    this.ctx.music.play('zither', 9, 0.6);
    this.ctx.save.progress.lanternLit = true;
    this.ctx.save.flush();
    if (this.lanternInteractable) this.remove(this.lanternInteractable);
    this.lanternInteractable = null;
    this.complete('lantern');
  }

  override restore() {
    this.takeLantern(this.lanterns[0], LANTERN_COLORS[0]);
    this.lightLantern();
  }

  /** A new day: the lantern is back under the awning and the vilakku have burnt out overnight. */
  override reset() {
    super.reset();
    if (this.lanternInteractable) this.remove(this.lanternInteractable);
    this.lanternInteractable = null;
    this.handHolder.clear();
    this.handLantern = null;
    this.handPivot = null;
    this.lanternFlame = null;
    this.lanternLight = null;
    this.lanternLit = false;
    for (const l of this.lanterns) l.visible = true;
    for (const l of this.lamps) l.lit = false;
    this.lampLight.intensity = 0;
  }

  private crackEggs() {
    this.eggsCracked = true;
    for (const e of this.eggs) e.visible = false;
    this.yolks = new THREE.Group();
    const white = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.02, 14), mat('#f8f4ea', { transparent: true, opacity: 0.85, roughness: 0.3, flat: false }));
    white.position.y = 0.02;
    this.yolks.add(white);
    for (let i = 0; i < 2; i++) {
      const y = sphere(0.025, '#f2a61d', 8, { roughness: 0.3, flat: false });
      y.scale.set(1, 0.6, 1);
      y.position.set((i - 0.5) * 0.06, 0.035, (i - 0.5) * 0.02);
      this.yolks.add(y);
    }
    const soyDrizzle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 4, 12), mat('#2a1a12'));
    soyDrizzle.rotation.x = Math.PI / 2;
    soyDrizzle.position.y = 0.045;
    this.yolks.add(soyDrizzle);
    this.yolks.position.set(-1.05, 0.78, 3.05);
    this.group.add(this.yolks);
    this.ctx.synth.crackEgg();
    window.setTimeout(() => this.memory('egg'), 1200);
  }

  // ---------------------------------------------------------------- kolam drawing

  private resetKolam() {
    const c = this.kolamCtx;
    c.clearRect(0, 0, 512, 512);
    // pulli: the dot grid every kolam begins from
    c.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < 7; j++) {
        c.beginPath();
        c.arc(64 + i * 64, 64 + j * 64, 3, 0, Math.PI * 2);
        c.fill();
      }
  }

  private paint(ndc: THREE.Vector2) {
    this.raycaster.setFromCamera(ndc, this.ctx.camera);
    const hits = this.raycaster.intersectObject(this.kolamPlane, false);
    if (!hits.length || !hits[0].uv) return;
    this.dot(hits[0].uv.x, hits[0].uv.y);
  }

  private dot(u: number, v: number) {
    const c = this.kolamCtx;
    const x = u * 512;
    const y = (1 - v) * 512;
    c.fillStyle = KOLAM_COLORS[this.kolamColor];
    const cx = 256;
    const cy = 256;
    const dx = x - cx;
    const dy = y - cy;
    const pts: [number, number][] = [
      [dx, dy],
      [-dx, dy],
      [dx, -dy],
      [-dx, -dy],
      [dy, dx],
      [-dy, dx],
      [dy, -dx],
      [-dy, -dx],
    ];
    for (const [px, py] of pts) {
      c.beginPath();
      c.arc(cx + px, cy + py, 7, 0, Math.PI * 2);
      c.fill();
    }
    this.kolamTex.needsUpdate = true;
    this.strokes++;
    if (this.strokes % 6 === 0) {
      this.ctx.synth.leaf(0.15);
      if (this.strokes % 24 === 0) this.ctx.music.step('veena', 0.3);
    }
    if (this.strokes === 40) this.memory('kolam');
    this.checkKolamComplete();
  }

  private checkKolamComplete() {
    const lit = this.lamps.filter((l) => l.lit).length;
    if (this.strokes >= 40 && lit >= 2) this.complete('kolam');
  }

  override update(dt: number, time: number) {
    this.tickSeat(dt);
    this.kopiSteam.update(dt);
    this.putuSteam.update(dt);
    const night = this.ctx.time.night;
    const dusk = THREE.MathUtils.smoothstep(this.ctx.time.hour, 18.2, 19.4);
    const lightsOn = Math.max(night, dusk);
    for (let i = 0; i < this.streetLights.length; i++) {
      this.streetLights[i].intensity = lightsOn * 5;
      (this.bulbs[i].material as THREE.MeshStandardMaterial).emissiveIntensity = lightsOn * 2.5;
    }
    (this.shopGlow.material as THREE.MeshBasicMaterial).opacity = lightsOn * 0.55;
    for (const l of this.lamps) {
      const fm = l.flame.material as THREE.SpriteMaterial;
      const gm = l.glow.material as THREE.SpriteMaterial;
      fm.opacity += ((l.lit ? 0.9 + Math.sin(time * 15 + l.flame.position.x) * 0.1 : 0) - fm.opacity) * Math.min(1, dt * 6);
      gm.opacity += ((l.lit ? 0.4 : 0) - gm.opacity) * Math.min(1, dt * 3);
    }
    if (this.handLantern && this.handPivot) {
      // it swings a little from the wire as you walk, and the candle flickers
      const w = this.ctx.locomotion.walking;
      this.handPivot.rotation.z = 0.05 + Math.sin(time * 2.2) * 0.06 * (0.3 + w);
      this.handPivot.rotation.x = Math.sin(time * 1.7) * 0.05 * (0.3 + w);
      if (this.lanternFlame) {
        (this.lanternFlame.material as THREE.SpriteMaterial).opacity = 0.85 + Math.sin(time * 19) * 0.12;
        this.lanternFlame.scale.set(0.075 + Math.sin(time * 23) * 0.006, 0.12 + Math.sin(time * 17) * 0.01, 1);
      }
      if (this.lanternLight) this.lanternLight.intensity = 3 + Math.sin(time * 11) * 0.5;
    }
    this.catTail.rotation.y = Math.sin(time * 0.7) * 0.15;
  }
}
