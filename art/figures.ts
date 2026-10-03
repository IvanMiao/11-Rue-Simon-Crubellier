import * as THREE from 'three';
import { LINE, PALETTE, Resident } from './palette';
import { canvas, texture } from './textures';
import { toonMaterial } from './materials';

export type Pose = 'stand' | 'reach' | 'tray' | 'paint';

const CW = 460;
const CH = 1000;

function stroke(ctx: CanvasRenderingContext2D, fill: string) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
}

/** Ligne-claire figure in three-quarter view facing +x. Flat fills, one ink weight, no gradients. */
export function drawFigure(ctx: CanvasRenderingContext2D, r: Resident, pose: Pose) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 7;
  const cx = 200;

  // back arm (behind the coat)
  ctx.beginPath();
  ctx.moveTo(cx - 70, 320);
  ctx.quadraticCurveTo(cx - 98, 440, cx - 84, 560);
  ctx.lineTo(cx - 52, 560);
  ctx.quadraticCurveTo(cx - 60, 440, cx - 34, 330);
  ctx.closePath();
  stroke(ctx, shade(r.coat, -0.18));

  // legs
  ctx.beginPath();
  ctx.moveTo(cx - 62, 620);
  ctx.lineTo(cx - 66, 925);
  ctx.lineTo(cx - 18, 925);
  ctx.lineTo(cx - 6, 660);
  ctx.lineTo(cx + 10, 660);
  ctx.lineTo(cx + 26, 925);
  ctx.lineTo(cx + 74, 925);
  ctx.lineTo(cx + 62, 620);
  ctx.closePath();
  stroke(ctx, r.trousers);
  // shoes
  for (const [x0, x1] of [[cx - 74, cx - 8], [cx + 22, cx + 100]]) {
    ctx.beginPath();
    ctx.moveTo(x0, 925);
    ctx.lineTo(x1 - 14, 922);
    ctx.quadraticCurveTo(x1, 930, x1, 950);
    ctx.lineTo(x0, 950);
    ctx.closePath();
    stroke(ctx, PALETTE.ink);
  }

  // coat
  ctx.beginPath();
  ctx.moveTo(cx - 74, 300);
  ctx.quadraticCurveTo(cx, 280, cx + 76, 300);
  ctx.quadraticCurveTo(cx + 96, 330, cx + 92, 420);
  ctx.lineTo(cx + 96, 660);
  ctx.quadraticCurveTo(cx, 676, cx - 92, 660);
  ctx.lineTo(cx - 90, 420);
  ctx.quadraticCurveTo(cx - 96, 330, cx - 74, 300);
  ctx.closePath();
  stroke(ctx, r.coat);
  // shadow side of the coat (flat, one step darker)
  ctx.save();
  ctx.clip();
  ctx.fillStyle = shade(r.coat, -0.16);
  ctx.fillRect(cx - 100, 270, 48, 420);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(cx - 74, 300);
  ctx.quadraticCurveTo(cx, 280, cx + 76, 300);
  ctx.quadraticCurveTo(cx + 96, 330, cx + 92, 420);
  ctx.lineTo(cx + 96, 660);
  ctx.quadraticCurveTo(cx, 676, cx - 92, 660);
  ctx.lineTo(cx - 90, 420);
  ctx.quadraticCurveTo(cx - 96, 330, cx - 74, 300);
  ctx.stroke();
  // shirt V + tie + lapels
  ctx.beginPath();
  ctx.moveTo(cx - 26, 292);
  ctx.lineTo(cx + 34, 292);
  ctx.lineTo(cx + 6, 410);
  ctx.closePath();
  stroke(ctx, PALETTE.linen);
  ctx.beginPath();
  ctx.moveTo(cx - 2, 300);
  ctx.lineTo(cx + 14, 300);
  ctx.lineTo(cx + 18, 380);
  ctx.lineTo(cx + 6, 400);
  ctx.lineTo(cx - 6, 380);
  ctx.closePath();
  stroke(ctx, PALETTE.accent);
  ctx.beginPath();
  ctx.moveTo(cx - 30, 292);
  ctx.lineTo(cx + 2, 420);
  ctx.moveTo(cx + 38, 292);
  ctx.lineTo(cx + 10, 420);
  ctx.stroke();
  // buttons + pocket
  ctx.fillStyle = PALETTE.ink;
  for (const y of [470, 540]) {
    ctx.beginPath();
    ctx.arc(cx + 14, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(cx + 40, 520);
  ctx.lineTo(cx + 84, 520);
  ctx.stroke();

  // front arm per pose
  ctx.beginPath();
  if (pose === 'reach') {
    ctx.moveTo(cx + 54, 310);
    ctx.quadraticCurveTo(cx + 120, 360, cx + 150, 440);
    ctx.lineTo(cx + 236, 420);
    ctx.lineTo(cx + 236, 460);
    ctx.lineTo(cx + 130, 486);
    ctx.quadraticCurveTo(cx + 90, 420, cx + 50, 380);
  } else if (pose === 'tray') {
    ctx.moveTo(cx + 54, 310);
    ctx.quadraticCurveTo(cx + 96, 380, cx + 100, 460);
    ctx.lineTo(cx + 200, 452);
    ctx.lineTo(cx + 200, 488);
    ctx.lineTo(cx + 70, 500);
    ctx.quadraticCurveTo(cx + 66, 420, cx + 46, 370);
  } else if (pose === 'paint') {
    ctx.moveTo(cx + 54, 310);
    ctx.quadraticCurveTo(cx + 130, 330, cx + 170, 260);
    ctx.lineTo(cx + 204, 278);
    ctx.quadraticCurveTo(cx + 150, 380, cx + 56, 390);
  } else {
    ctx.moveTo(cx + 56, 312);
    ctx.quadraticCurveTo(cx + 104, 430, cx + 92, 570);
    ctx.lineTo(cx + 58, 572);
    ctx.quadraticCurveTo(cx + 66, 440, cx + 40, 360);
  }
  ctx.closePath();
  stroke(ctx, r.coat);
  // hand
  const hand: Record<Pose, [number, number]> = {
    reach: [cx + 252, 440],
    tray: [cx + 214, 470],
    paint: [cx + 200, 252],
    stand: [cx + 76, 592],
  };
  const [hx, hy] = hand[pose];
  ctx.beginPath();
  ctx.ellipse(hx, hy, 22, 18, 0, 0, Math.PI * 2);
  stroke(ctx, r.skin);
  if (pose === 'reach') {
    // the missing piece, held up to the light
    ctx.save();
    ctx.translate(hx + 26, hy - 26);
    ctx.rotate(-0.3);
    ctx.beginPath();
    ctx.rect(-16, -16, 32, 32);
    ctx.moveTo(16, -6);
    ctx.arc(22, 0, 8, -Math.PI / 2, Math.PI / 2);
    stroke(ctx, PALETTE.sea);
    ctx.restore();
  }
  if (pose === 'tray') {
    ctx.beginPath();
    ctx.rect(hx - 70, hy - 34, 150, 12);
    stroke(ctx, PALETTE.brass);
    ctx.beginPath();
    ctx.rect(hx - 30, hy - 70, 30, 36);
    stroke(ctx, PALETTE.linen);
  }
  if (pose === 'paint') {
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + 50, hy - 50);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx + 54, hy - 54, 8, 0, Math.PI * 2);
    stroke(ctx, PALETTE.accent);
    ctx.lineWidth = 7;
  }

  // neck + head
  ctx.beginPath();
  ctx.rect(cx - 16, 214, 40, 82);
  stroke(ctx, r.skin);
  ctx.beginPath();
  ctx.ellipse(cx - 46, 176, 14, 22, 0, 0, Math.PI * 2);
  stroke(ctx, r.skin);
  ctx.beginPath();
  ctx.moveTo(cx - 50, 130);
  ctx.quadraticCurveTo(cx - 40, 78, cx + 12, 80);
  ctx.quadraticCurveTo(cx + 70, 84, cx + 64, 150);
  ctx.lineTo(cx + 82, 182);
  ctx.lineTo(cx + 64, 190);
  ctx.quadraticCurveTo(cx + 60, 236, cx + 8, 240);
  ctx.quadraticCurveTo(cx - 48, 238, cx - 50, 130);
  ctx.closePath();
  stroke(ctx, r.skin);
  // hair
  ctx.beginPath();
  if (r.id === 'bartlebooth' || r.id === 'winckler' || r.id === 'valene') {
    ctx.moveTo(cx - 52, 168);
    ctx.quadraticCurveTo(cx - 62, 110, cx - 20, 92);
    ctx.quadraticCurveTo(cx - 24, 120, cx - 30, 168);
    ctx.closePath();
  } else {
    ctx.moveTo(cx - 52, 160);
    ctx.quadraticCurveTo(cx - 52, 70, cx + 18, 72);
    ctx.quadraticCurveTo(cx + 74, 78, cx + 66, 128);
    ctx.quadraticCurveTo(cx + 10, 104, cx - 26, 130);
    ctx.lineTo(cx - 30, 170);
    ctx.closePath();
  }
  stroke(ctx, r.hair);
  // eye, brow, mouth
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.arc(cx + 40, 160, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx + 26, 138);
  ctx.lineTo(cx + 56, 140);
  ctx.moveTo(cx + 36, 212);
  ctx.lineTo(cx + 58, 208);
  ctx.stroke();
  if (r.id === 'bartlebooth' || r.id === 'winckler') {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx + 40, 162, 18, 0, Math.PI * 2);
    ctx.moveTo(cx + 22, 160);
    ctx.lineTo(cx - 34, 166);
    ctx.stroke();
  }
  ctx.lineWidth = 7;
}

function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}

/** Adds a paper border by dilating the alpha silhouette, like a figure cut out with scissors. */
function withPaperBorder(src: HTMLCanvasElement, px: number): HTMLCanvasElement {
  return canvas(src.width, src.height, (ctx) => {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.drawImage(src, Math.cos(a) * px, Math.sin(a) * px);
    }
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = PALETTE.linen;
    ctx.fillRect(0, 0, src.width, src.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(src, 0, 0);
  });
}

export function figureCanvas(r: Resident, pose: Pose): HTMLCanvasElement {
  const raw = canvas(CW, CH, (ctx) => {
    ctx.translate(10, 20);
    drawFigure(ctx, r, pose);
  });
  return withPaperBorder(raw, LINE.cutoutBorderPx * 1.6);
}

/**
 * A paper cut-out standing in the 3D room: alpha-tested card that receives and casts real shadows,
 * with a small wooden foot so it reads as a theatre flat.
 */
export function paperCutout(src: HTMLCanvasElement, worldHeight: number, opts: { mirror?: boolean } = {}): THREE.Group {
  const map = texture(src);
  const w = (worldHeight * src.width) / src.height;
  const geo = new THREE.PlaneGeometry(w, worldHeight);
  geo.translate(0, worldHeight / 2, 0);
  const mat = toonMaterial('#ffffff', { map, alphaTest: 0.5, side: THREE.DoubleSide });
  const card = new THREE.Mesh(geo, mat);
  card.castShadow = true;
  card.receiveShadow = true;
  card.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
  card.userData.cutout = map;
  if (opts.mirror) card.scale.x = -1;
  const g = new THREE.Group();
  g.add(card);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(w * 0.35, 0.05, 0.16), toonMaterial(PALETTE.woodDark));
  foot.position.set(0, 0.025, -0.06);
  foot.castShadow = true;
  g.add(foot);
  return g;
}
