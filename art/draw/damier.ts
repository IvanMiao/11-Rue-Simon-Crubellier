import { CHARCOAL, PALETTE, WASH, WASH_FALLBACK } from '../palette';

type Ctx = CanvasRenderingContext2D;

export interface DamierCell {
  id: string;
  floor: number;
  col: number;
  chapter: number | null;
  apartmentId: string;
}

export interface DamierView {
  cells: DamierCell[];
  visited: ReadonlySet<string>;
  clinamenId: string;
}

/** Geometry shared by the canvas painter and the DOM overlay that sits on top of it. */
export const DAMIER = {
  cols: 10,
  rows: 10,
  roof: 0.55,
  street: 0.35,
  margin: 0.25,
};

export function damierSize(cell: number) {
  return {
    width: (DAMIER.cols + DAMIER.margin * 2) * cell,
    height: (DAMIER.rows + DAMIER.roof + DAMIER.street + DAMIER.margin * 2) * cell,
  };
}

/** Top-left corner of a cell in canvas units. Floor 8 is the top row, floor -1 the bottom. */
export function cellOrigin(floor: number, col: number, cell: number) {
  return {
    x: (DAMIER.margin + col - 1) * cell,
    y: (DAMIER.margin + DAMIER.roof + (8 - floor)) * cell,
  };
}

export function washFor(apartmentId: string): string {
  if (WASH[apartmentId]) return WASH[apartmentId];
  let hash = 0;
  for (const ch of apartmentId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return WASH_FALLBACK[hash % WASH_FALLBACK.length];
}

function rng(seedText: string) {
  let seed = 2166136261;
  for (const ch of seedText) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function charcoalLine(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, rand: () => number, weight: number, alpha: number) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = CHARCOAL.line;
  for (let pass = 0; pass < 2; pass += 1) {
    const j = weight * 0.9;
    ctx.globalAlpha = alpha * (pass === 0 ? 1 : 0.45);
    ctx.lineWidth = weight * (pass === 0 ? 1 : 0.6);
    ctx.beginPath();
    ctx.moveTo(x1 + (rand() - 0.5) * j, y1 + (rand() - 0.5) * j);
    const mx = (x1 + x2) / 2 + (rand() - 0.5) * j * 1.5;
    const my = (y1 + y2) / 2 + (rand() - 0.5) * j * 1.5;
    ctx.quadraticCurveTo(mx, my, x2 + (rand() - 0.5) * j, y2 + (rand() - 0.5) * j);
    ctx.stroke();
  }
  ctx.restore();
}

function paperGround(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = CHARCOAL.primed;
  ctx.fillRect(0, 0, w, h);
  const rand = rng('linen');
  ctx.save();
  for (let i = 0; i < (w * h) / 90; i += 1) {
    ctx.globalAlpha = 0.035 + rand() * 0.05;
    ctx.fillStyle = rand() > 0.5 ? CHARCOAL.faint : PALETTE.linen;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1);
  }
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = CHARCOAL.faint;
  ctx.lineWidth = 0.6;
  for (let y = 0; y < h; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y + rand());
    ctx.lineTo(w, y + rand());
    ctx.stroke();
  }
  ctx.restore();
}

function wash(ctx: Ctx, x: number, y: number, s: number, colour: string, rand: () => number) {
  ctx.save();
  ctx.fillStyle = colour;
  for (let i = 0; i < 5; i += 1) {
    ctx.globalAlpha = 0.11 + rand() * 0.05;
    const inset = s * (0.04 + rand() * 0.05);
    ctx.beginPath();
    const pts = 9;
    for (let p = 0; p < pts; p += 1) {
      const t = p / pts;
      const side = Math.floor(t * 4);
      const u = (t * 4) % 1;
      const wob = (rand() - 0.5) * s * 0.05;
      const px = side === 0 ? x + inset + u * (s - inset * 2) : side === 1 ? x + s - inset + wob : side === 2 ? x + s - inset - u * (s - inset * 2) : x + inset + wob;
      const py = side === 0 ? y + inset + wob : side === 1 ? y + inset + u * (s - inset * 2) : side === 2 ? y + s - inset + wob : y + s - inset - u * (s - inset * 2);
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  // Pigment pooling along the bottom edge, like a wash that dried on a tilted board.
  ctx.globalAlpha = 0.16;
  ctx.fillRect(x + s * 0.08, y + s * 0.84, s * 0.84, s * 0.06);
  ctx.restore();
}

function bitten(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save();
  ctx.fillStyle = CHARCOAL.wall;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x + s, y + s * 0.62);
  ctx.arc(x + s * 0.88, y + s * 0.82, s * 0.2, -Math.PI / 2, Math.PI, true);
  ctx.arc(x + s * 0.5, y + s * 0.92, s * 0.2, 0, Math.PI, true);
  ctx.arc(x + s * 0.14, y + s * 0.78, s * 0.18, 0, -Math.PI / 2, true);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Paints the static canvas: primed linen, charcoal grid, chapter numbers and the washes of entered cells. */
export function drawDamier(ctx: Ctx, view: DamierView, cell: number) {
  const { width, height } = damierSize(cell);
  paperGround(ctx, width, height);
  const byPos = new Map(view.cells.map((c) => [`${c.floor}:${c.col}`, c]));
  const at = (floor: number, col: number) => byPos.get(`${floor}:${col}`);

  view.cells.forEach((c) => {
    if (!view.visited.has(c.id) || c.id === view.clinamenId) return;
    const { x, y } = cellOrigin(c.floor, c.col, cell);
    wash(ctx, x, y, cell, washFor(c.apartmentId), rng(c.id));
  });

  // Roof line and pavement.
  const left = DAMIER.margin * cell;
  const right = (DAMIER.margin + DAMIER.cols) * cell;
  const top = (DAMIER.margin + DAMIER.roof) * cell;
  const bottom = top + DAMIER.rows * cell;
  const rand = rng('frame');
  charcoalLine(ctx, left - cell * 0.1, top, left + cell * 0.6, DAMIER.margin * cell, rand, 1.6, 0.7);
  charcoalLine(ctx, left + cell * 0.6, DAMIER.margin * cell, right - cell * 0.6, DAMIER.margin * cell, rand, 1.6, 0.7);
  charcoalLine(ctx, right - cell * 0.6, DAMIER.margin * cell, right + cell * 0.1, top, rand, 1.6, 0.7);
  [2, 4.3, 6.7, 8.6].forEach((cx) => {
    const x = left + cx * cell;
    charcoalLine(ctx, x, DAMIER.margin * cell + cell * 0.05, x, top - cell * 0.02, rand, 1, 0.5);
    charcoalLine(ctx, x + cell * 0.3, DAMIER.margin * cell + cell * 0.05, x + cell * 0.3, top - cell * 0.02, rand, 1, 0.5);
  });
  const ground = top + 9 * cell;
  charcoalLine(ctx, left - cell * 0.2, ground, right + cell * 0.2, ground, rand, 2.2, 0.8);
  for (let i = 0; i < 26; i += 1) {
    const x = left - cell * 0.2 + rand() * (right - left + cell * 0.4);
    charcoalLine(ctx, x, bottom + cell * 0.08, x + cell * 0.25, bottom + cell * 0.08, rand, 0.8, 0.25);
  }

  // Grid: faint inside an apartment, heavy across apartment walls.
  for (let floor = 8; floor >= -1; floor -= 1) {
    for (let col = 1; col <= 10; col += 1) {
      const here = at(floor, col);
      if (!here) continue;
      const { x, y } = cellOrigin(floor, col, cell);
      const r = rng(`${here.id}:grid`);
      const rightN = at(floor, col + 1);
      const belowN = at(floor - 1, col);
      const wallRight = !rightN || rightN.apartmentId !== here.apartmentId;
      const wallBelow = !belowN || belowN.apartmentId !== here.apartmentId;
      charcoalLine(ctx, x + cell, y, x + cell, y + cell, r, wallRight ? 2 : 0.8, wallRight ? 0.85 : 0.35);
      charcoalLine(ctx, x, y + cell, x + cell, y + cell, r, wallBelow ? 2 : 0.8, wallBelow ? 0.85 : 0.35);
      if (col === 1) charcoalLine(ctx, x, y, x, y + cell, r, 2, 0.85);
      if (floor === 8) charcoalLine(ctx, x, y, x + cell, y, r, 2, 0.85);

      if (here.id === view.clinamenId) {
        bitten(ctx, x, y, cell);
        continue;
      }
      if (here.chapter) {
        ctx.save();
        ctx.fillStyle = CHARCOAL.number;
        ctx.globalAlpha = view.visited.has(here.id) ? 0.9 : 0.55;
        ctx.font = `${Math.round(cell * 0.16)}px 'Courier Prime', monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(String(here.chapter), x + cell * 0.07, y + cell * 0.06);
        ctx.restore();
      }
    }
  }
}
