import * as THREE from 'three';
import { PALETTE } from './palette';
import { mulberry32 } from '../utils/rng';

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export function canvas(w: number, h: number, draw: Draw): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  return c;
}

export function texture(c: HTMLCanvasElement, opts: { repeat?: boolean; srgb?: boolean } = {}): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Jigsaw piece outline centred at (x, y) with body size s. Tabs: 1 out, -1 in, 0 flat (top, right, bottom, left). */
export function jigsawPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, tabs = [1, -1, 1, -1]) {
  const h = s / 2;
  const k = s * 0.22;
  const n = s * 0.17;
  const corners = [
    [x - h, y - h],
    [x + h, y - h],
    [x + h, y + h],
    [x - h, y + h],
  ];
  ctx.beginPath();
  ctx.moveTo(corners[0][0], corners[0][1]);
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[(i + 1) % 4];
    const dx = (bx - ax) / s;
    const dy = (by - ay) / s;
    // outward normal for a clockwise square in canvas space
    const nx = dy;
    const ny = -dx;
    const t = tabs[i];
    const p = (u: number, v: number): [number, number] => [ax + dx * s * u + nx * v * t, ay + dy * s * u + ny * v * t];
    if (t === 0) {
      ctx.lineTo(bx, by);
      continue;
    }
    ctx.lineTo(...p(0.36, 0));
    ctx.bezierCurveTo(...p(0.4, n * 0.2), ...p(0.3, k), ...p(0.5, k));
    ctx.bezierCurveTo(...p(0.7, k), ...p(0.6, n * 0.2), ...p(0.64, 0));
    ctx.lineTo(bx, by);
  }
  ctx.closePath();
}

/** Printing-paper substrate: grain, fibres, flecks. Used in screen space by the ink pass. */
export function paperTexture(): THREE.CanvasTexture {
  const rng = mulberry32(1975);
  const c = canvas(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = 200 + (rng() + rng() + rng()) * 18;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.lineCap = 'round';
    for (let i = 0; i < 260; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const a = rng() * Math.PI * 2;
      const l = 6 + rng() * 22;
      ctx.strokeStyle = rng() < 0.5 ? 'rgba(120,110,95,0.22)' : 'rgba(255,255,250,0.35)';
      ctx.lineWidth = 0.6 + rng() * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(90,75,60,${0.15 + rng() * 0.25})`;
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 0.5 + rng() * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  return texture(c, { repeat: true, srgb: false });
}

/** Full-wall wallpaper with a jigsaw-shaped bare patch (the clue). Size in world metres. */
export function wallpaperTexture(opts: { base: string; motif: string; width: number; height: number; gap?: [number, number] }) {
  const ppm = 220;
  const W = Math.round(opts.width * ppm);
  const H = Math.round(opts.height * ppm);
  const c = canvas(W, H, (ctx) => {
    ctx.fillStyle = opts.base;
    ctx.fillRect(0, 0, W, H);
    const step = 0.36 * ppm;
    ctx.strokeStyle = opts.motif;
    ctx.fillStyle = opts.motif;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    for (let x = step / 2; x < W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.8;
    let row = 0;
    for (let y = step / 2; y < H; y += step * 0.9, row++) {
      for (let x = (row % 2 ? 0 : step / 2); x < W + step; x += step) {
        // small fleuron: diamond + four dots
        ctx.beginPath();
        ctx.moveTo(x, y - 9);
        ctx.lineTo(x + 6, y);
        ctx.lineTo(x, y + 9);
        ctx.lineTo(x - 6, y);
        ctx.closePath();
        ctx.fill();
        for (const [dx, dy] of [[-13, 0], [13, 0], [0, -16], [0, 16]]) {
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    // dado rail shadow band near the floor
    ctx.fillStyle = 'rgba(80,50,20,0.10)';
    ctx.fillRect(0, H - 0.9 * ppm, W, 0.9 * ppm);
    if (opts.gap) {
      const [gx, gy] = opts.gap;
      const s = 0.2 * ppm;
      jigsawPath(ctx, gx * ppm, H - gy * ppm, s, [1, -1, -1, 1]);
      ctx.fillStyle = PALETTE.plaster;
      ctx.fill();
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 3;
      ctx.stroke();
      // torn paper fringe
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
  return texture(c);
}

export function woodFloorTexture(base: string, dark: string, width: number, depth: number) {
  const ppm = 200;
  const W = Math.round(width * ppm);
  const H = Math.round(depth * ppm);
  const rng = mulberry32(623);
  const c = canvas(W, H, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    const plank = 0.16 * ppm;
    for (let y = 0, r = 0; y < H; y += plank, r++) {
      let x = -rng() * 1.2 * ppm;
      while (x < W) {
        const len = (0.9 + rng() * 0.8) * ppm;
        ctx.fillStyle = rng() < 0.5 ? 'rgba(255,240,220,0.06)' : 'rgba(60,20,0,0.07)';
        ctx.fillRect(x, y, len, plank);
        ctx.strokeStyle = 'rgba(70,30,10,0.18)';
        ctx.lineWidth = 1;
        for (let g = 0; g < 3; g++) {
          const gy = y + plank * (0.25 + g * 0.25) + (rng() - 0.5) * 4;
          ctx.beginPath();
          ctx.moveTo(x + 4, gy);
          ctx.bezierCurveTo(x + len * 0.3, gy + (rng() - 0.5) * 6, x + len * 0.6, gy + (rng() - 0.5) * 6, x + len - 4, gy);
          ctx.stroke();
        }
        ctx.strokeStyle = dark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + plank);
        ctx.stroke();
        x += len;
      }
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  });
  return texture(c);
}

/** Watercolour harbour (Bartlebooth's subject). When `puzzle`, overlays the jigsaw cut and removes one piece. */
export function harbourTexture(opts: { puzzle: boolean; hole?: string; w?: number; h?: number }) {
  const W = opts.w ?? 900;
  const H = opts.h ?? 600;
  const rng = mulberry32(439);
  const c = canvas(W, H, (ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    sky.addColorStop(0, '#9cc6e0');
    sky.addColorStop(1, '#f5d9a8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const blob = (x: number, y: number, r: number, col: string, a: number) => {
      ctx.globalAlpha = a;
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        const rr = r * (0.8 + rng() * 0.35);
        const px = x + Math.cos(ang) * rr * 1.6;
        const py = y + Math.sin(ang) * rr * 0.7;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    for (let i = 0; i < 9; i++) blob(rng() * W, H * (0.08 + rng() * 0.25), 30 + rng() * 40, '#ffffff', 0.25);
    ctx.fillStyle = '#f7d774';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(W * 0.72, H * 0.3, H * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // far coast
    ctx.fillStyle = '#7f9aa3';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.52);
    for (let x = 0; x <= W; x += 30) ctx.lineTo(x, H * (0.5 - 0.04 * Math.sin(x * 0.012) - rng() * 0.012));
    ctx.lineTo(W, H * 0.56);
    ctx.lineTo(0, H * 0.56);
    ctx.fill();
    const sea = ctx.createLinearGradient(0, H * 0.55, 0, H);
    sea.addColorStop(0, '#3f86b5');
    sea.addColorStop(1, PALETTE.sea);
    ctx.fillStyle = sea;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.15 + rng() * 0.25})`;
      ctx.lineWidth = 2;
      const y = H * (0.6 + rng() * 0.38);
      const x = rng() * W;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 20 + rng() * 40, y);
      ctx.stroke();
    }
    // quay with houses on the left
    ctx.fillStyle = '#d9b48a';
    ctx.fillRect(0, H * 0.48, W * 0.22, H * 0.1);
    const houses = ['#e9d3b0', '#c96a4a', '#f0e2c4', '#b8865a'];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = houses[i % houses.length];
      const hx = i * W * 0.045;
      const hh = H * (0.12 + rng() * 0.08);
      ctx.fillRect(hx, H * 0.5 - hh, W * 0.045, hh);
      ctx.fillStyle = '#6b4a3a';
      ctx.fillRect(hx + 6, H * 0.5 - hh + 10, 6, 9);
    }
    // sailing boat
    const bx = W * 0.55;
    const by = H * 0.68;
    ctx.fillStyle = PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(bx - 60, by);
    ctx.lineTo(bx + 70, by);
    ctx.lineTo(bx + 45, by + 24);
    ctx.lineTo(bx - 40, by + 24);
    ctx.fill();
    ctx.fillStyle = '#fbf6ea';
    ctx.beginPath();
    ctx.moveTo(bx, by - 4);
    ctx.lineTo(bx, by - 140);
    ctx.lineTo(bx + 62, by - 6);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx - 6, by - 6);
    ctx.lineTo(bx - 6, by - 110);
    ctx.lineTo(bx - 50, by - 8);
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx - 3, by);
    ctx.lineTo(bx - 3, by - 145);
    ctx.stroke();
    // watercolour bloom edges
    for (let i = 0; i < 60; i++) blob(rng() * W, rng() * H, 8 + rng() * 26, rng() < 0.5 ? '#ffffff' : '#2b4d6e', 0.04);

    if (opts.puzzle) {
      const cols = 6;
      const rows = 4;
      const s = W / cols;
      const sy = H / rows;
      ctx.strokeStyle = 'rgba(40,30,20,0.55)';
      ctx.lineWidth = 2;
      for (let r = 0; r < rows; r++) {
        for (let q = 0; q < cols; q++) {
          ctx.save();
          ctx.translate(q * s + s / 2, r * sy + sy / 2);
          ctx.scale(1, sy / s);
          const tabs = [r === 0 ? 0 : (q + r) % 2 ? 1 : -1, q === cols - 1 ? 0 : (q + r) % 2 ? -1 : 1, r === rows - 1 ? 0 : (q + r) % 2 ? -1 : 1, q === 0 ? 0 : (q + r) % 2 ? 1 : -1];
          jigsawPath(ctx, 0, 0, s, tabs);
          ctx.restore();
          ctx.stroke();
        }
      }
      // the missing piece: row 2, col 3 (sea under the boat)
      ctx.save();
      ctx.translate(3 * s + s / 2, 2 * sy + sy / 2);
      ctx.scale(1, sy / s);
      jigsawPath(ctx, 0, 0, s, [-1, 1, 1, -1]);
      ctx.restore();
      ctx.fillStyle = opts.hole ?? PALETTE.wood;
      ctx.fill();
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  });
  return texture(c);
}

/** Sky behind the rear facade: 20:00 gradient, sun, zinc roofs and chimney pots. */
export function skylineTexture(width: number, height: number) {
  const ppm = 90;
  const W = Math.round(width * ppm);
  const H = Math.round(height * ppm);
  const rng = mulberry32(11);
  const c = canvas(W, H, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#9fc3dd');
    g.addColorStop(0.55, '#e9d6b4');
    g.addColorStop(0.8, PALETTE.skyWarm);
    g.addColorStop(1, '#f2b27a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,240,200,0.9)';
    ctx.beginPath();
    ctx.arc(W * 0.3, H * 0.62, 70, 0, Math.PI * 2);
    ctx.fill();
    const layer = (base: number, col: string, amp: number) => {
      ctx.fillStyle = col;
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2;
      let x = 0;
      ctx.beginPath();
      ctx.moveTo(0, H);
      while (x < W) {
        const bw = 80 + rng() * 160;
        const top = H * base - rng() * amp;
        ctx.lineTo(x, top + 18);
        ctx.lineTo(x + 18, top);
        ctx.lineTo(x + bw - 18, top);
        ctx.lineTo(x + bw, top + 18);
        x += bw;
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };
    layer(0.78, '#b9a7a0', 40);
    layer(0.86, PALETTE.roof, 50);
    for (let i = 0; i < 26; i++) {
      const x = rng() * W;
      const y = H * (0.8 + rng() * 0.08);
      ctx.fillStyle = '#a2553c';
      ctx.fillRect(x, y - 40, 22, 40);
      ctx.strokeRect(x, y - 40, 22, 40);
      ctx.fillStyle = '#7a3d2a';
      for (let p = 0; p < 3; p++) ctx.fillRect(x + 2 + p * 7, y - 50, 5, 10);
    }
  });
  return texture(c);
}

export function clockTexture() {
  const c = canvas(256, 256, (ctx, w) => {
    const r = w / 2 - 8;
    ctx.translate(w / 2, w / 2);
    ctx.fillStyle = PALETTE.linen;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = PALETTE.ink;
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.lineWidth = i % 3 ? 3 : 6;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * r * 0.78, -Math.cos(a) * r * 0.78);
      ctx.lineTo(Math.sin(a) * r * 0.9, -Math.cos(a) * r * 0.9);
      ctx.stroke();
    }
    // 20:00 -> hour hand at 8, minute at 12
    ctx.lineCap = 'round';
    ctx.lineWidth = 10;
    const ha = (8 / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(ha) * r * 0.5, -Math.cos(ha) * r * 0.5);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r * 0.74);
    ctx.stroke();
    ctx.fillStyle = PALETTE.accent;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
  });
  return texture(c);
}

export function bookSpinesTexture(seed: number) {
  const rng = mulberry32(seed);
  const cols = ['#24356b', '#c8372d', '#4e8f5a', '#e1b54a', '#7a4c7a', '#2e6fa3', '#efe4c8', '#8a5a33'];
  const c = canvas(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3a2618';
    ctx.fillRect(0, 0, w, h);
    let x = 0;
    while (x < w) {
      const bw = 14 + rng() * 22;
      const bh = h * (0.7 + rng() * 0.3);
      ctx.fillStyle = cols[Math.floor(rng() * cols.length)];
      ctx.fillRect(x, h - bh, bw - 2, bh);
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, h - bh, bw - 2, bh);
      ctx.fillStyle = 'rgba(255,240,200,0.7)';
      ctx.fillRect(x + 3, h - bh + 10, bw - 8, 3);
      x += bw;
    }
  });
  return texture(c);
}

export function rugTexture(main: string, border: string) {
  const c = canvas(512, 320, (ctx, w, h) => {
    ctx.fillStyle = border;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = main;
    ctx.fillRect(26, 26, w - 52, h - 52);
    ctx.strokeStyle = PALETTE.linen;
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, w - 80, h - 80);
    ctx.beginPath();
    ctx.moveTo(w / 2, 70);
    ctx.lineTo(w / 2 + 90, h / 2);
    ctx.lineTo(w / 2, h - 70);
    ctx.lineTo(w / 2 - 90, h / 2);
    ctx.closePath();
    ctx.stroke();
    // fringe
    ctx.strokeStyle = PALETTE.linen;
    ctx.lineWidth = 2;
    for (let x = 4; x < w; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 12);
      ctx.moveTo(x, h);
      ctx.lineTo(x, h - 12);
      ctx.stroke();
    }
  });
  return texture(c);
}

/** Small engraved plate text, e.g. floor numbers on the section slab. */
export function labelTexture(text: string, opts: { fg?: string; bg?: string; font?: string; w?: number; h?: number } = {}) {
  const c = canvas(opts.w ?? 256, opts.h ?? 96, (ctx, w, h) => {
    ctx.fillStyle = opts.bg ?? PALETTE.ink;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = opts.fg ?? PALETTE.paper;
    ctx.font = opts.font ?? `600 ${Math.round(h * 0.55)}px 'Noto Serif CJK SC', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
  return texture(c);
}
