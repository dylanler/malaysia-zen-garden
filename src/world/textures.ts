import * as THREE from 'three';
import { rng } from '../core/util';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

function tex(c: HTMLCanvasElement, repeat = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

const cache = new Map<string, THREE.Texture>();
function memo(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

export function ringTexture() {
  return memo('ring', () => {
    const { c, ctx } = canvas(128, 128);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 64, 44, 0, Math.PI * 2);
    ctx.stroke();
    const g = ctx.createRadialGradient(64, 64, 20, 64, 64, 60);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export function softCircleTexture() {
  return memo('soft', () => {
    const { c, ctx } = canvas(64, 64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  });
}

export function flameTexture() {
  return memo('flame', () => {
    const { c, ctx } = canvas(64, 96);
    const g = ctx.createRadialGradient(32, 62, 4, 32, 56, 40);
    g.addColorStop(0, 'rgba(255,250,220,1)');
    g.addColorStop(0.35, 'rgba(255,190,90,0.9)');
    g.addColorStop(0.7, 'rgba(255,110,40,0.35)');
    g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(32, 56, 22, 38, 0, 0, Math.PI * 2);
    ctx.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** Corrugated zinc roof: vertical stripes with rust. */
export function zincTexture() {
  return memo('zinc', () => {
    const { c, ctx } = canvas(256, 256);
    const r = rng(11);
    ctx.fillStyle = '#8e9299';
    ctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, '#6f747c');
      g.addColorStop(0.5, '#a9adb4');
      g.addColorStop(1, '#6f747c');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 16, 256);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${120 + r() * 60},${70 + r() * 30},${40},${0.15 + r() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(r() * 256, r() * 256, 6 + r() * 20, 3 + r() * 10, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    return tex(c, 1);
  });
}

export function plankTexture(base = '#8a5a3a', dark = '#5e3a22') {
  return memo(`plank${base}`, () => {
    const { c, ctx } = canvas(256, 256);
    const r = rng(7);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      ctx.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.1})`;
      ctx.fillRect(0, y, 256, 2);
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const yy = y + 4 + r() * 24;
        ctx.moveTo(0, yy);
        ctx.bezierCurveTo(80, yy + r() * 4 - 2, 160, yy - r() * 4 + 2, 256, yy);
        ctx.stroke();
      }
    }
    ctx.fillStyle = dark;
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 12; i++) ctx.fillRect(r() * 256, r() * 256, 2, 2);
    ctx.globalAlpha = 1;
    return tex(c, 1);
  });
}

/** Woven mat (tikar mengkuang). */
export function weaveTexture(a = '#c9a86a', b = '#a8824a') {
  return memo(`weave${a}`, () => {
    const { c, ctx } = canvas(128, 128);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? a : b;
        ctx.fillRect(x * 16, y * 16, 16, 16);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        if ((x + y) % 2 === 0) ctx.fillRect(x * 16, y * 16, 16, 2);
        else ctx.fillRect(x * 16, y * 16, 2, 16);
      }
    return tex(c, 6);
  });
}

/** Plaid kain pelikat. */
export function plaidTexture(seed = 3) {
  return memo(`plaid${seed}`, () => {
    const { c, ctx } = canvas(256, 256);
    const r = rng(seed);
    const palettes = [
      ['#2a4a7a', '#8fb0d8', '#e0c070'],
      ['#7a2a3a', '#d89aa0', '#f0e0c0'],
      ['#2a6a4a', '#a0d8b0', '#f0e8a0'],
    ];
    const p = palettes[seed % palettes.length];
    ctx.fillStyle = p[0];
    ctx.fillRect(0, 0, 256, 256);
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 6; i++) {
      const w = 6 + r() * 20;
      const x = r() * 256;
      ctx.fillStyle = p[1 + Math.floor(r() * 2)];
      ctx.fillRect(x, 0, w, 256);
      ctx.fillRect(0, x, 256, w);
    }
    ctx.globalAlpha = 1;
    return tex(c, 2);
  });
}

/** Batik-inspired: repeating leaf/flower motifs on an indigo or turmeric base. */
export function batikTexture(seed = 5) {
  return memo(`batik${seed}`, () => {
    const { c, ctx } = canvas(256, 256);
    const r = rng(seed);
    const bases = ['#2b3a7a', '#a86a1a', '#6a2a4a'];
    const inks = ['#e9d8a6', '#f6efe2', '#f2c98a'];
    ctx.fillStyle = bases[seed % bases.length];
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = inks[seed % inks.length];
    ctx.lineWidth = 2;
    for (let gy = 0; gy < 4; gy++)
      for (let gx = 0; gx < 4; gx++) {
        const cx = gx * 64 + 32;
        const cy = gy * 64 + 32;
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + r() * 0.2;
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 12, 5, a, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + 32, cy + 32, 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    return tex(c, 1);
  });
}

/**
 * Pua-kumbu-inspired geometry: original motif (mirrored hooks, diamonds, zigzags)
 * in red, black and cream. Not a reproduction of any specific woven design.
 */
export function puaTexture(seed = 9, rows = 48, cols = 32) {
  return memo(`pua${seed}`, () => {
    const cell = 8;
    const { c, ctx } = canvas(cols * cell, rows * cell);
    const r = rng(seed);
    const cream = '#e8d6b0';
    const red = '#9a2f24';
    const black = '#1e1610';
    ctx.fillStyle = red;
    ctx.fillRect(0, 0, c.width, c.height);
    const grid: number[][] = [];
    for (let y = 0; y < rows; y++) {
      grid.push(new Array(cols).fill(0));
    }
    // diamond lattice
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols / 2; x++) {
        const d = Math.abs(((y + 6) % 12) - 6) + Math.abs((x % 8) - 4);
        let v = 0;
        if (d === 4 || d === 5) v = 1;
        if (d <= 1) v = 2;
        if (y % 12 === 0 && x % 2 === 0) v = 2;
        // hooks
        if ((y + 3) % 12 < 2 && x % 8 > 1 && x % 8 < 4) v = 1;
        if (r() < 0.03) v = 0;
        grid[y][x] = v;
        grid[y][cols - 1 - x] = v;
      }
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const v = grid[y][x];
        if (v === 0) continue;
        ctx.fillStyle = v === 1 ? cream : black;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    // border stripes
    ctx.fillStyle = black;
    ctx.fillRect(0, 0, cell, c.height);
    ctx.fillRect(c.width - cell, 0, cell, c.height);
    ctx.fillStyle = cream;
    ctx.fillRect(cell, 0, cell / 2, c.height);
    ctx.fillRect(c.width - cell * 1.5, 0, cell / 2, c.height);
    const t = tex(c, 1);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

/** Peranakan-style encaustic floor tiles. */
export function tileTexture(seed = 2) {
  return memo(`tile${seed}`, () => {
    const { c, ctx } = canvas(256, 256);
    const palettes = [
      ['#e8e0d0', '#5a8a7a', '#c86a5a', '#e0b060'],
      ['#efe6d6', '#6a7ab0', '#d09060', '#a0b090'],
    ];
    const p = palettes[seed % palettes.length];
    ctx.fillStyle = p[0];
    ctx.fillRect(0, 0, 256, 256);
    for (let gy = 0; gy < 2; gy++)
      for (let gx = 0; gx < 2; gx++) {
        const ox = gx * 128;
        const oy = gy * 128;
        ctx.fillStyle = p[1];
        ctx.beginPath();
        ctx.moveTo(ox + 64, oy + 8);
        ctx.lineTo(ox + 120, oy + 64);
        ctx.lineTo(ox + 64, oy + 120);
        ctx.lineTo(ox + 8, oy + 64);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = p[0];
        ctx.beginPath();
        ctx.arc(ox + 64, oy + 64, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p[2];
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(ox + 64 + Math.cos(a) * 16, oy + 64 + Math.sin(a) * 16, 9, 5, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = p[3];
        ctx.beginPath();
        ctx.arc(ox + 64, oy + 64, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.strokeRect(ox + 0.5, oy + 0.5, 127, 127);
      }
    return tex(c, 1);
  });
}

/** Banana leaf with lighter veins. */
export function leafTexture() {
  return memo('leaf', () => {
    const { c, ctx } = canvas(256, 256);
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, '#3f7a2e');
    g.addColorStop(0.5, '#4f8f38');
    g.addColorStop(1, '#3a6f2a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(200,230,150,0.35)';
    ctx.lineWidth = 1.5;
    for (let y = 0; y < 256; y += 9) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + 6);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(230,240,180,0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 128);
    ctx.lineTo(256, 128);
    ctx.stroke();
    return tex(c, 1);
  });
}

/** Brown paper with a hint of newsprint. */
export function paperTexture() {
  return memo('paper', () => {
    const { c, ctx } = canvas(256, 256);
    const r = rng(21);
    ctx.fillStyle = '#b8935f';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = `rgba(90,60,30,${r() * 0.12})`;
      ctx.fillRect(r() * 256, r() * 256, 2, 1);
    }
    ctx.fillStyle = 'rgba(60,40,30,0.35)';
    for (let y = 20; y < 240; y += 7) {
      let x = 16;
      while (x < 240) {
        const w = 6 + r() * 22;
        ctx.fillRect(x, y, w, 2);
        x += w + 5;
      }
    }
    return tex(c, 1);
  });
}

/** Floral enamel thermos pattern. */
export function floralTexture() {
  return memo('floral', () => {
    const { c, ctx } = canvas(128, 128);
    const r = rng(33);
    ctx.fillStyle = '#f2e9db';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 9; i++) {
      const cx = r() * 128;
      const cy = r() * 128;
      const col = ['#d8506a', '#e8a040', '#5a8ad0'][i % 3];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 6, 3.5, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#f6e28a';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4a8a4a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 8);
      ctx.quadraticCurveTo(cx + 6, cy + 18, cx + 2, cy + 28);
      ctx.stroke();
    }
    return tex(c, 2);
  });
}

/** Kek lapis Sarawak layered side. */
export function lapisTexture() {
  return memo('lapis', () => {
    const { c, ctx } = canvas(64, 128);
    const cols = ['#f2c14e', '#c94c4c', '#3a7d44', '#f28c28', '#8e44ad', '#f6efe2'];
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(0, i * 8, 64, 8);
    }
    return tex(c, 1);
  });
}

/** A simple noise texture for water/waterfall shaders (linear). */
export function noiseTexture(size = 256, seed = 1) {
  return memo(`noise${size}${seed}`, () => {
    const { c, ctx } = canvas(size, size);
    const img = ctx.createImageData(size, size);
    const r = rng(seed);
    // low frequency blobs layered with fine grain
    const blobs: number[][] = [];
    for (let i = 0; i < 60; i++) blobs.push([r() * size, r() * size, 10 + r() * 40, r()]);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let v = 0;
        for (const [bx, by, br, bv] of blobs) {
          let dx = x - bx;
          let dy = y - by;
          if (dx > size / 2) dx -= size;
          if (dx < -size / 2) dx += size;
          if (dy > size / 2) dy -= size;
          if (dy < -size / 2) dy += size;
          const d = Math.hypot(dx, dy) / br;
          if (d < 1) v += (1 - d) * (1 - d) * bv;
        }
        v = Math.min(1, v * 0.9 + r() * 0.15);
        const i = (y * size + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.floor(v * 255);
        img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    return tex(c, 1, false);
  });
}

/** A painted signboard. The lettering is sized to fit the board with a margin, however long the name. */
export function signTexture(text: string, bg = '#d9c9a3', fg = '#3a2a1a', aspect = 4) {
  const h = 128;
  const w = Math.round(h * aspect);
  const { c, ctx } = canvas(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // a thin painted border, like the hand-lettered boards of old shophouses
  ctx.strokeStyle = fg;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.globalAlpha = 1;
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 72;
  const maxWidth = w - 40;
  for (; size > 16; size -= 2) {
    ctx.font = `bold ${size}px Georgia, serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  ctx.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Wau bulan decoration: layered floral cut-work in bright colours. */
export function wauTexture() {
  return memo('wau', () => {
    const { c, ctx } = canvas(256, 256);
    ctx.fillStyle = '#f4efe6';
    ctx.fillRect(0, 0, 256, 256);
    const cols = ['#d8262f', '#1f6fb2', '#f2b632', '#2f9e44', '#8e3b9a'];
    for (let ring = 0; ring < 5; ring++) {
      ctx.strokeStyle = cols[ring];
      ctx.lineWidth = 6;
      const n = 8 + ring * 4;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const rr = 26 + ring * 22;
        ctx.beginPath();
        ctx.ellipse(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr, 12, 6, a, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    return tex(c, 1);
  });
}
