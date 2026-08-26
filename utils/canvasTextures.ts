import * as THREE from 'three';
import { mulberry32 } from './rng';

const cache = new Map<string, THREE.CanvasTexture>();

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function make(size: number, paint: (ctx: CanvasRenderingContext2D, size: number) => void, key: string) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    cache.set(key, fallback);
    return fallback;
  }
  paint(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

function grain(ctx: CanvasRenderingContext2D, size: number, amp: number, seed: number) {
  const rng = mulberry32(seed);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rng() - 0.48) * amp;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n * 0.92));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.78));
  }
  ctx.putImageData(img, 0, 0);
}

export function tiled(tex: THREE.CanvasTexture, rx: number, ry: number): THREE.CanvasTexture {
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

export function plasterTexture(hex: string): THREE.CanvasTexture {
  return make(256, (ctx, size) => {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, size, size);
    grain(ctx, size, 18, 12);
    ctx.strokeStyle = 'rgba(40,24,12,0.045)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 7; i += 1) {
      ctx.beginPath();
      ctx.moveTo(20 + i * 34, 0);
      ctx.bezierCurveTo(i * 40, 80, 200 - i * 18, 160, 40 + i * 28, size);
      ctx.stroke();
    }
  }, `plaster:${hex}`);
}

export type PaperKind = 'damask' | 'stripe' | 'toile' | 'stone';

export function wallpaperTexture(hex: string, accent: string, kind: PaperKind = 'damask'): THREE.CanvasTexture {
  return make(256, (ctx, size) => {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, size, size);
    if (kind === 'stone') {
      ctx.fillStyle = '#9a8a74';
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 28) {
        const ox = (Math.floor(y / 28) % 2) * 22;
        for (let x = -22; x < size; x += 44) {
          ctx.fillStyle = `rgb(${140 + ((x + y) % 18)},${122 + (x % 10)},${96})`;
          ctx.fillRect(x + ox + 1, y + 1, 41, 25);
        }
      }
      grain(ctx, size, 16, 3);
      return;
    }
    if (kind === 'stripe') {
      ctx.globalAlpha = 0.28;
      for (let x = 0; x < size; x += 18) {
        ctx.fillStyle = x % 36 === 0 ? accent : 'rgba(40,24,12,0.25)';
        ctx.fillRect(x, 0, 7, size);
      }
      ctx.globalAlpha = 1;
      grain(ctx, size, 12, 8);
      return;
    }
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.globalAlpha = kind === 'toile' ? 0.28 : 0.2;
    const step = kind === 'toile' ? 48 : 40;
    for (let y = 8; y < size + step; y += step) {
      for (let x = 8; x < size + step; x += step) {
        const ox = (Math.floor(y / step) % 2) * (step / 2);
        ctx.beginPath();
        ctx.moveTo(x + ox, y - 14);
        ctx.quadraticCurveTo(x + ox + 11, y, x + ox, y + 14);
        ctx.quadraticCurveTo(x + ox - 11, y, x + ox, y - 14);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + ox, y - 2, 2.2, 0, Math.PI * 2);
        ctx.fill();
        if (kind === 'toile') {
          ctx.beginPath();
          ctx.ellipse(x + ox + 8, y + 6, 5, 3, 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    grain(ctx, size, 10, 21);
  }, `wall:${kind}:${hex}:${accent}`);
}

export function woodTexture(): THREE.CanvasTexture {
  return make(256, (ctx, size) => {
    const g = ctx.createLinearGradient(0, 0, size, 0);
    g.addColorStop(0, '#6e4a2c');
    g.addColorStop(0.5, '#8a6238');
    g.addColorStop(1, '#5c3c24');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 1) {
      const wave = Math.sin(y / 13) * 10 + Math.sin(y / 5) * 2;
      ctx.fillStyle = y % 19 < 2 ? 'rgba(50,30,14,0.35)' : `rgba(120,70,30,${0.04 + (y % 9) * 0.01})`;
      ctx.fillRect(wave, y, size, 1);
    }
    grain(ctx, size, 10, 4);
  }, 'wood');
}

export function parquetTexture(): THREE.CanvasTexture {
  return make(256, (ctx, size) => {
    ctx.fillStyle = '#5a3c24';
    ctx.fillRect(0, 0, size, size);
    const plank = 18;
    for (let row = 0; row < size / plank; row += 1) {
      for (let col = 0; col < size / plank; col += 1) {
        const x = col * plank;
        const y = row * plank;
        ctx.save();
        ctx.translate(x + plank / 2, y + plank / 2);
        ctx.rotate(((row + col) % 2 === 0 ? 1 : -1) * Math.PI / 4);
        ctx.fillStyle = (row + col) % 3 === 0 ? '#7a522e' : '#6a4428';
        ctx.fillRect(-11, -4.2, 22, 8.4);
        ctx.strokeStyle = 'rgba(30,16,8,0.35)';
        ctx.strokeRect(-11, -4.2, 22, 8.4);
        ctx.restore();
      }
    }
    grain(ctx, size, 8, 9);
  }, 'parquet');
}

export function zincTexture(): THREE.CanvasTexture {
  return make(256, (ctx, size) => {
    const g = ctx.createLinearGradient(0, 0, size, 0);
    g.addColorStop(0, '#6a6760');
    g.addColorStop(0.5, '#8a8680');
    g.addColorStop(1, '#5c5a54');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 22) {
      ctx.fillStyle = 'rgba(20,18,14,0.28)';
      ctx.fillRect(x, 0, 3, size);
      ctx.fillStyle = 'rgba(230,220,200,0.12)';
      ctx.fillRect(x + 3, 0, 2, size);
    }
    grain(ctx, size, 14, 2);
  }, 'zinc');
}

export function limestoneTexture(): THREE.CanvasTexture {
  return make(256, (ctx, size) => {
    ctx.fillStyle = '#c4b49a';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 36) {
      const ox = (Math.floor(y / 36) % 2) * 28;
      for (let x = -28; x < size; x += 56) {
        const [r, g, b] = [196 + ((x * y) % 16), 178 + (x % 12), 148 + (y % 8)];
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x + ox + 1, y + 1, 53, 33);
        ctx.strokeStyle = 'rgba(90,70,50,0.25)';
        ctx.strokeRect(x + ox + 1, y + 1, 53, 33);
      }
    }
    grain(ctx, size, 12, 6);
  }, 'lime');
}

export function cobbleTexture(): THREE.CanvasTexture {
  return make(256, (ctx, size) => {
    ctx.fillStyle = '#2e2c28';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 16) {
      for (let x = 0; x < size; x += 20) {
        const ox = (Math.floor(y / 16) % 2) * 10;
        ctx.fillStyle = `rgb(${58 + ((x * 3 + y) % 22)},${52 + (x % 14)},${44})`;
        ctx.fillRect(x + ox + 1, y + 1, 17, 13);
      }
    }
    grain(ctx, size, 10, 11);
  }, 'cobble');
}

export function fabricTexture(hex: string): THREE.CanvasTexture {
  return make(128, (ctx, size) => {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,240,220,0.12)';
    for (let i = 0; i < size; i += 4) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
    grain(ctx, size, 16, hexToRgb(hex)[0]);
  }, `fabric:${hex}`);
}

export function rugTexture(hex: string, accent: string): THREE.CanvasTexture {
  return make(256, (ctx, size) => {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, size - 28, size - 28);
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, size - 48, size - 48);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(size / 2, size / 2, 48, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    grain(ctx, size, 14, 17);
  }, `rug:${hex}:${accent}`);
}

export function paintingTexture(seed: number, lamp: string, paint: string): THREE.CanvasTexture {
  return make(256, (ctx, size) => {
    const rng = mulberry32(seed);
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, paint);
    g.addColorStop(1, '#2a2018');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 7; i += 1) {
      ctx.fillStyle = i % 2 ? lamp : '#f4ead6';
      ctx.globalAlpha = 0.35 + rng() * 0.4;
      ctx.beginPath();
      ctx.ellipse(
        40 + rng() * 170,
        50 + rng() * 150,
        18 + rng() * 40,
        12 + rng() * 28,
        rng() * Math.PI,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#1c1610';
    ctx.beginPath();
    ctx.ellipse(size * 0.45, size * 0.62, 22, 36, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    grain(ctx, size, 20, seed);
  }, `paint:${seed}:${lamp}:${paint}`);
}

export function nightSkyTexture(): THREE.CanvasTexture {
  return make(512, (ctx, size) => {
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#1a2744');
    g.addColorStop(0.42, '#3a4060');
    g.addColorStop(0.7, '#c47848');
    g.addColorStop(1, '#6a4030');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#f4ead6';
    const rng = mulberry32(1975);
    for (let i = 0; i < 70; i += 1) {
      ctx.globalAlpha = 0.15 + rng() * 0.55;
      ctx.fillRect(rng() * size, rng() * size * 0.45, 1.4, 1.4);
    }
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#f8e0b0';
    ctx.beginPath();
    ctx.arc(size * 0.78, size * 0.28, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#141018';
    const roofs = [
      [0, 0.62, 0.18, 0.4],
      [0.16, 0.55, 0.22, 0.5],
      [0.36, 0.6, 0.14, 0.42],
      [0.5, 0.52, 0.2, 0.5],
      [0.68, 0.58, 0.18, 0.44],
      [0.84, 0.54, 0.2, 0.5],
    ];
    roofs.forEach(([x, y, w, h]) => {
      ctx.fillRect(x * size, y * size, w * size, h * size);
      ctx.beginPath();
      ctx.moveTo(x * size, y * size);
      ctx.lineTo((x + w / 2) * size, (y - 0.06) * size);
      ctx.lineTo((x + w) * size, y * size);
      ctx.fill();
    });
    ctx.fillStyle = '#e8b14a';
    for (let i = 0; i < 24; i += 1) {
      ctx.globalAlpha = 0.35 + rng() * 0.5;
      ctx.fillRect(20 + rng() * (size - 40), size * 0.62 + rng() * size * 0.28, 3, 5);
    }
    ctx.globalAlpha = 1;
  }, 'sky');
}

export function leatherTexture(hex: string): THREE.CanvasTexture {
  const [r, g, b] = hexToRgb(hex);
  return make(128, (ctx, size) => {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, size, size);
    grain(ctx, size, 22, r + g + b);
  }, `leather:${hex}`);
}
