// Card glyphs: ligne-claire pictograms for every case card and signature object.
// Canvas 2D only (no three.js) so the React app can rasterise them.
// Each glyph draws in a 100×100 box: one ink weight, flat fills, one shadow step, no gradients.
import { PALETTE, TONES } from '../palette';
import type { GlyphId } from '../cast';

type Ctx = CanvasRenderingContext2D;
type GlyphDraw = (ctx: Ctx) => void;

const INK = PALETTE.ink;
const LW = 4;

function fillStroke(ctx: Ctx, fill: string | null, path: () => void, lw = LW) {
  ctx.beginPath();
  path();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.lineWidth = lw;
  ctx.stroke();
}

function rect(ctx: Ctx, fill: string | null, x: number, y: number, w: number, h: number, lw = LW) {
  fillStroke(ctx, fill, () => ctx.rect(x, y, w, h), lw);
}

function circle(ctx: Ctx, fill: string | null, x: number, y: number, r: number, lw = LW) {
  fillStroke(ctx, fill, () => ctx.arc(x, y, r, 0, Math.PI * 2), lw);
}

function poly(ctx: Ctx, fill: string | null, pts: number[], lw = LW) {
  fillStroke(
    ctx,
    fill,
    () => {
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath();
    },
    lw
  );
}

function line(ctx: Ctx, pts: number[], lw = LW, color: string = INK) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.strokeStyle = INK;
}

/** Ruled lines inside a box, used by paper glyphs. */
function rules(ctx: Ctx, x0: number, x1: number, y0: number, y1: number, step: number, color: string = TONES.hairGrey) {
  for (let y = y0; y <= y1; y += step) line(ctx, [x0, y, x1, y], 2.2, color);
}

/** A letter-shaped watercolour piece: fat ink stroke, then the fill stroke, with jigsaw knobs at the ends. */
function letterPiece(ctx: Ctx, strokes: number[][], knobs: number[][]) {
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  for (const s of strokes) line(ctx, s, 22, INK);
  for (const [x, y] of knobs) circle(ctx, INK, x, y, 9.5, 0.01);
  for (const s of strokes) line(ctx, s, 14, PALETTE.sea);
  for (const [x, y] of knobs) {
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.sea;
    ctx.fill();
  }
  // watercolour fleck: the harbour's sky on the piece
  for (const s of strokes) line(ctx, [s[0], s[1], (s[0] + s[2]) / 2, (s[1] + s[3]) / 2], 4, PALETTE.sky);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function calendarLeaf(ctx: Ctx, big: string, small: string) {
  rect(ctx, PALETTE.paperDeep, 20, 18, 64, 70);
  rect(ctx, PALETTE.linen, 16, 14, 64, 70);
  rect(ctx, PALETTE.accent, 16, 14, 64, 16);
  for (const x of [30, 66]) circle(ctx, PALETTE.linen, x, 14, 4, 3);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${big.length > 2 ? 22 : 34}px 'Courier Prime', 'DejaVu Sans Mono', monospace`;
  ctx.fillText(big, 48, 57);
  ctx.font = `700 11px 'Courier Prime', 'DejaVu Sans Mono', monospace`;
  ctx.fillStyle = PALETTE.linen;
  ctx.fillText(small, 48, 23);
}

const GLYPHS: Record<string, GlyphDraw> = {
  // ── shapes: the hole is X, the piece is W ───────────────────────────────
  'shape-x': (ctx) => letterPiece(ctx, [[24, 24, 76, 76], [76, 24, 24, 76]], [[50, 18], [50, 82]]),
  'shape-w': (ctx) => letterPiece(ctx, [[14, 24, 32, 78, 50, 38, 68, 78, 86, 24]], [[50, 22], [14, 50]]),
  'shape-v': (ctx) => letterPiece(ctx, [[22, 22, 50, 80, 78, 22]], [[50, 34]]),

  // ── places ──────────────────────────────────────────────────────────────
  'pl-loge': (ctx) => {
    // the concierge's half-glazed door with its curtain and bell
    rect(ctx, PALETTE.wood, 26, 14, 48, 76);
    rect(ctx, PALETTE.light, 32, 22, 36, 30);
    poly(ctx, TONES.cobalt, [32, 22, 50, 22, 40, 52, 32, 52], 3);
    rect(ctx, PALETTE.woodDark, 32, 60, 36, 22, 3);
    circle(ctx, PALETTE.brass, 66, 64, 3.5, 3);
    circle(ctx, PALETTE.brass, 84, 26, 7, 3);
    line(ctx, [84, 10, 84, 19], 3);
  },
  'pl-attic': (ctx) => {
    // mansard dormer of a servant's room
    poly(ctx, PALETTE.roof, [6, 92, 22, 52, 78, 52, 94, 92]);
    poly(ctx, PALETTE.plaster, [30, 56, 50, 22, 70, 56]);
    rect(ctx, PALETTE.plaster, 32, 54, 36, 34);
    rect(ctx, PALETTE.light, 38, 58, 24, 26, 3);
    line(ctx, [50, 58, 50, 84], 3);
    line(ctx, [38, 70, 62, 70], 3);
  },
  'pl-studio': (ctx) => {
    // easel with a gridded canvas
    line(ctx, [32, 92, 46, 16], 5);
    line(ctx, [68, 92, 54, 16], 5);
    line(ctx, [50, 14, 56, 92], 4);
    rect(ctx, PALETTE.linen, 26, 24, 48, 40);
    for (let i = 1; i < 4; i++) {
      line(ctx, [26 + i * 12, 24, 26 + i * 12, 64], 1.6);
      line(ctx, [26, 24 + i * 10, 74, 24 + i * 10], 1.6);
    }
    rect(ctx, TONES.aubergine, 38, 34, 12, 10, 1.6);
    rect(ctx, PALETTE.accent, 50, 44, 12, 10, 1.6);
    rect(ctx, PALETTE.woodDark, 22, 64, 56, 6, 3);
  },
  'pl-cellar': (ctx) => {
    // the boiler, its gauge and the coal fire
    fillStroke(ctx, TONES.coal, () => {
      ctx.moveTo(26, 88);
      ctx.lineTo(26, 30);
      ctx.quadraticCurveTo(26, 12, 50, 12);
      ctx.quadraticCurveTo(74, 12, 74, 30);
      ctx.lineTo(74, 88);
      ctx.closePath();
    });
    rect(ctx, TONES.steel, 26, 40, 48, 6, 3);
    circle(ctx, PALETTE.linen, 50, 28, 8, 3);
    line(ctx, [50, 28, 55, 23], 2.5);
    rect(ctx, TONES.coal, 36, 60, 28, 22, 3);
    poly(ctx, PALETTE.accent, [40, 82, 44, 66, 50, 74, 55, 62, 60, 82], 3);
    poly(ctx, PALETTE.light, [46, 82, 50, 72, 54, 82], 2);
    line(ctx, [74, 22, 90, 22, 90, 6], 6);
  },
  'pl-antiques': (ctx) => {
    // a carriage clock stopped at eight
    rect(ctx, PALETTE.brass, 24, 26, 52, 62);
    fillStroke(ctx, null, () => {
      ctx.moveTo(38, 26);
      ctx.quadraticCurveTo(50, 6, 62, 26);
    }, 4);
    rect(ctx, PALETTE.woodDark, 20, 84, 60, 8);
    circle(ctx, PALETTE.linen, 50, 54, 18);
    line(ctx, [50, 54, 50, 42], 3.5);
    line(ctx, [50, 54, 41, 59], 3.5);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      line(ctx, [50 + Math.cos(a) * 14, 54 + Math.sin(a) * 14, 50 + Math.cos(a) * 16.5, 54 + Math.sin(a) * 16.5], 1.6);
    }
  },
  'pl-bartlebooth': (ctx) => {
    // the 439th puzzle seen from above: one piece missing
    rect(ctx, PALETTE.wood, 8, 14, 84, 72);
    rect(ctx, PALETTE.sky, 16, 22, 68, 26, 3);
    rect(ctx, PALETTE.sea, 16, 48, 68, 30, 3);
    poly(ctx, PALETTE.paper, [26, 48, 34, 36, 42, 48], 2.5);
    for (let i = 1; i < 4; i++) line(ctx, [16 + i * 17, 22, 16 + i * 17, 78], 1.4);
    line(ctx, [16, 48, 84, 48], 1.4);
    line(ctx, [16, 63, 84, 63], 1.4);
    // the X-shaped hole
    ctx.lineCap = 'butt';
    line(ctx, [58, 51, 74, 69], 11, INK);
    line(ctx, [74, 51, 58, 69], 11, INK);
    line(ctx, [58, 51, 74, 69], 6, PALETTE.wood);
    line(ctx, [74, 51, 58, 69], 6, PALETTE.wood);
    ctx.lineCap = 'round';
  },

  // ── objects ─────────────────────────────────────────────────────────────
  'o-death-notice': (ctx) => {
    rect(ctx, PALETTE.linen, 18, 10, 64, 80);
    rect(ctx, null, 26, 20, 48, 40, 5);
    line(ctx, [50, 26, 50, 46], 3);
    line(ctx, [43, 32, 57, 32], 3);
    rules(ctx, 32, 68, 52, 56, 4, INK);
    rules(ctx, 26, 74, 68, 84, 6);
  },
  'o-cut-notes': (ctx) => {
    rect(ctx, PALETTE.paperDeep, 20, 14, 62, 76);
    rect(ctx, PALETTE.linen, 14, 10, 62, 76);
    for (let x = 22; x < 72; x += 8) circle(ctx, PALETTE.paper, x, 10, 2.5, 2);
    // pencilled cut lines
    ctx.setLineDash([4, 3]);
    line(ctx, [22, 30, 68, 30], 2.2, TONES.charcoal);
    line(ctx, [22, 52, 68, 52], 2.2, TONES.charcoal);
    line(ctx, [40, 20, 40, 78], 2.2, TONES.charcoal);
    ctx.setLineDash([]);
    // a W and an X pencilled in the margin
    line(ctx, [48, 60, 52, 72, 56, 64, 60, 72, 64, 60], 2.6);
    line(ctx, [24, 60, 34, 72], 2.6);
    line(ctx, [34, 60, 24, 72], 2.6);
    // pencil
    poly(ctx, PALETTE.light, [62, 90, 90, 62, 95, 67, 67, 95]);
    poly(ctx, PALETTE.paper, [62, 90, 67, 95, 57, 99], 3);
  },
  'o-ledger-439': (ctx) => {
    // an open ledger; the 439th line is underlined in red
    poly(ctx, TONES.leather, [6, 24, 50, 30, 94, 24, 94, 84, 50, 90, 6, 84]);
    poly(ctx, PALETTE.linen, [10, 20, 50, 26, 50, 84, 10, 78]);
    poly(ctx, PALETTE.linen, [50, 26, 90, 20, 90, 78, 50, 84]);
    for (let i = 0; i < 6; i++) {
      line(ctx, [16, 32 + i * 8, 44, 36 + i * 8], 1.6, TONES.hairGrey);
      line(ctx, [56, 36 + i * 8, 84, 32 + i * 8], 1.6, TONES.hairGrey);
    }
    line(ctx, [56, 52, 84, 48], 3.4, PALETTE.accent);
    ctx.fillStyle = INK;
    ctx.font = `700 10px 'Courier Prime', 'DejaVu Sans Mono', monospace`;
    ctx.fillText('439', 62, 46);
  },
  'o-blank-sheet': (ctx) => {
    // a watercolour washed back to white: only the ghost of a horizon remains
    fillStroke(ctx, PALETTE.linen, () => {
      ctx.moveTo(14, 18);
      for (let x = 14; x <= 86; x += 6) ctx.lineTo(x, 18 + ((x / 6) % 2 ? 1.6 : -1.6));
      ctx.lineTo(86, 82);
      for (let x = 86; x >= 14; x -= 6) ctx.lineTo(x, 82 + ((x / 6) % 2 ? 1.6 : -1.6));
      ctx.closePath();
    });
    line(ctx, [22, 56, 40, 52, 58, 56, 78, 52], 2, TONES.glass);
    line(ctx, [30, 64, 50, 62, 70, 64], 2, TONES.glass);
    circle(ctx, null, 66, 34, 6, 1.6);
  },
  'o-coal-glove': (ctx) => {
    fillStroke(ctx, TONES.leather, () => {
      ctx.moveTo(30, 90);
      ctx.lineTo(28, 50);
      ctx.lineTo(16, 38);
      ctx.quadraticCurveTo(14, 30, 22, 32);
      ctx.lineTo(32, 40);
      ctx.lineTo(32, 18);
      ctx.quadraticCurveTo(37, 12, 41, 18);
      ctx.lineTo(43, 36);
      ctx.lineTo(46, 12);
      ctx.quadraticCurveTo(51, 7, 55, 13);
      ctx.lineTo(55, 36);
      ctx.lineTo(60, 16);
      ctx.quadraticCurveTo(65, 12, 68, 18);
      ctx.lineTo(66, 40);
      ctx.lineTo(72, 26);
      ctx.quadraticCurveTo(77, 24, 78, 30);
      ctx.lineTo(70, 62);
      ctx.lineTo(70, 90);
      ctx.closePath();
    });
    rect(ctx, TONES.apron, 28, 78, 44, 12, 3);
    // coal dust on the fingers
    for (const [x, y, r] of [[38, 24, 4], [52, 20, 5], [62, 28, 3.5], [46, 46, 6]]) circle(ctx, TONES.coal, x, y, r, 0.01);
    poly(ctx, TONES.coal, [72, 92, 78, 80, 90, 82, 94, 92], 3);
  },
  'o-receipt': (ctx) => {
    fillStroke(ctx, PALETTE.linen, () => {
      ctx.moveTo(26, 8);
      ctx.lineTo(74, 8);
      ctx.lineTo(74, 84);
      for (let i = 0; i < 8; i++) ctx.lineTo(74 - i * 6 - 3, i % 2 ? 84 : 90);
      ctx.lineTo(26, 84);
      ctx.closePath();
    });
    rules(ctx, 32, 68, 18, 50, 8);
    line(ctx, [32, 60, 68, 60], 3);
    // the shop's stamp with the time on it
    circle(ctx, null, 56, 72, 9, 2.6);
    ctx.strokeStyle = PALETTE.accent;
    circle(ctx, null, 56, 72, 9, 2.6);
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `700 7px 'Courier Prime', 'DejaVu Sans Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('20:00', 56, 74.5);
    ctx.strokeStyle = INK;
  },
  'o-wet-brush': (ctx) => {
    ctx.save();
    ctx.translate(50, 50);
    ctx.rotate(-Math.PI / 4);
    rect(ctx, PALETTE.wood, -6, -44, 12, 52);
    rect(ctx, TONES.steel, -7, 8, 14, 12);
    fillStroke(ctx, TONES.cobalt, () => {
      ctx.moveTo(-7, 20);
      ctx.quadraticCurveTo(-9, 34, 0, 44);
      ctx.quadraticCurveTo(9, 34, 7, 20);
      ctx.closePath();
    });
    ctx.restore();
    // the drop that has not dried
    fillStroke(ctx, TONES.cobalt, () => {
      ctx.moveTo(84, 66);
      ctx.quadraticCurveTo(78, 80, 84, 84);
      ctx.quadraticCurveTo(90, 80, 84, 66);
    }, 3);
  },

  // ── times ───────────────────────────────────────────────────────────────
  't-1973': (ctx) => calendarLeaf(ctx, '1973', 'ANNÉE'),
  't-1975': (ctx) => calendarLeaf(ctx, '23', 'JUIN 75'),
  't-1950': (ctx) => calendarLeaf(ctx, '1950', 'ANNÉE'),

  // ── words ───────────────────────────────────────────────────────────────
  'w-revenge': (ctx) => {
    // twenty years run out: an hourglass with a cracked glass
    rect(ctx, PALETTE.woodDark, 22, 8, 56, 8);
    rect(ctx, PALETTE.woodDark, 22, 84, 56, 8);
    poly(ctx, TONES.glass, [28, 16, 72, 16, 54, 50, 72, 84, 28, 84, 46, 50]);
    poly(ctx, PALETTE.light, [32, 84, 68, 84, 50, 66], 2.5);
    line(ctx, [50, 50, 50, 66], 2, PALETTE.light);
    line(ctx, [64, 22, 58, 32, 63, 38], 2.6, PALETTE.accent);
  },
  'w-gift': (ctx) => {
    rect(ctx, PALETTE.linen, 18, 40, 64, 48);
    rect(ctx, PALETTE.paperDeep, 14, 30, 72, 14);
    rect(ctx, PALETTE.accent, 44, 30, 12, 58, 3);
    fillStroke(ctx, PALETTE.accent, () => {
      ctx.ellipse(38, 24, 12, 7, -0.4, 0, Math.PI * 2);
    }, 3);
    fillStroke(ctx, PALETTE.accent, () => {
      ctx.ellipse(62, 24, 12, 7, 0.4, 0, Math.PI * 2);
    }, 3);
  },
  'w-mistake': (ctx) => {
    // a snapped pencil and the stray line it left
    line(ctx, [12, 78, 88, 70], 2.4, TONES.hairGrey);
    line(ctx, [52, 74, 70, 86, 90, 82], 3, PALETTE.accent);
    poly(ctx, PALETTE.light, [10, 46, 44, 34, 47, 42, 13, 54]);
    poly(ctx, PALETTE.light, [54, 30, 82, 20, 85, 28, 57, 38]);
    poly(ctx, PALETTE.paper, [82, 20, 94, 20, 85, 28], 3);
    line(ctx, [44, 34, 48, 30, 50, 37, 54, 30], 2.4);
  },

  // ── signature objects that are not case cards ───────────────────────────
  'i-magnifier': (ctx) => {
    poly(ctx, PALETTE.woodDark, [56, 62, 64, 54, 92, 82, 84, 90]);
    circle(ctx, PALETTE.brass, 40, 40, 28);
    circle(ctx, TONES.glass, 40, 40, 21);
    line(ctx, [28, 34, 34, 26], 3, PALETTE.linen);
  },
  'i-paintbox': (ctx) => {
    rect(ctx, TONES.charcoal, 10, 30, 80, 46);
    rect(ctx, TONES.steel, 10, 22, 80, 8, 3);
    const pans = [PALETTE.sea, PALETTE.sky, PALETTE.accent, PALETTE.light, TONES.bottle, PALETTE.wood];
    pans.forEach((c, i) => rect(ctx, c, 16 + (i % 3) * 24, 36 + Math.floor(i / 3) * 20, 18, 14, 3));
  },
  'i-fretsaw': (ctx) => {
    ctx.save();
    ctx.translate(50, 50);
    ctx.rotate(-0.4);
    line(ctx, [-28, 12, -28, -32, 30, -32, 30, 12], 9, INK);
    line(ctx, [-28, 12, -28, -32, 30, -32, 30, 12], 4, TONES.steel);
    const teeth: number[] = [];
    for (let i = 0; i <= 10; i++) teeth.push(-28 + i * 5.8, 12 + (i % 2 ? 3 : -1));
    line(ctx, teeth, 2);
    fillStroke(ctx, PALETTE.wood, () => {
      ctx.moveTo(-36, 14);
      ctx.lineTo(-20, 14);
      ctx.lineTo(-22, 44);
      ctx.quadraticCurveTo(-28, 50, -34, 44);
      ctx.closePath();
    });
    ctx.restore();
  },
  'i-flask': (ctx) => {
    fillStroke(ctx, TONES.glass, () => {
      ctx.moveTo(40, 12);
      ctx.lineTo(40, 40);
      ctx.lineTo(16, 86);
      ctx.lineTo(84, 86);
      ctx.lineTo(60, 40);
      ctx.lineTo(60, 12);
      ctx.closePath();
    });
    poly(ctx, PALETTE.light, [27, 66, 73, 66, 84, 86, 16, 86], 3);
    rect(ctx, PALETTE.woodDark, 36, 6, 28, 8, 3);
    circle(ctx, PALETTE.linen, 46, 76, 2.5, 1.5);
  },
  'i-bandage': (ctx) => {
    // a hand with three fingers bound together
    fillStroke(ctx, TONES.skinRuddy, () => {
      ctx.moveTo(28, 92);
      ctx.lineTo(28, 52);
      ctx.lineTo(16, 42);
      ctx.quadraticCurveTo(14, 34, 22, 36);
      ctx.lineTo(34, 44);
      ctx.lineTo(36, 22);
      ctx.quadraticCurveTo(41, 16, 45, 22);
      ctx.lineTo(46, 46);
      ctx.lineTo(72, 46);
      ctx.lineTo(70, 92);
      ctx.closePath();
    });
    rect(ctx, TONES.bandage, 46, 26, 26, 30);
    for (let y = 32; y < 56; y += 7) line(ctx, [46, y, 72, y - 3], 2);
  },
  'i-keys': (ctx) => {
    circle(ctx, null, 32, 26, 14, 5);
    const key = (rot: number, color: string) => {
      ctx.save();
      ctx.translate(32, 26);
      ctx.rotate(rot);
      circle(ctx, color, 0, 22, 8, 3);
      rect(ctx, color, -3, 30, 6, 40, 3);
      rect(ctx, color, 3, 58, 8, 5, 2.5);
      rect(ctx, color, 3, 65, 6, 5, 2.5);
      ctx.restore();
    };
    key(-0.25, PALETTE.brass);
    key(-0.75, TONES.steel);
    key(-1.25, PALETTE.brass);
  },
  'i-broom': (ctx) => {
    line(ctx, [72, 6, 46, 62], 5);
    poly(ctx, PALETTE.brass, [36, 58, 54, 66, 50, 74, 32, 66], 3);
    poly(ctx, PALETTE.light, [32, 66, 50, 74, 42, 96, 10, 84]);
    for (let i = 0; i < 4; i++) line(ctx, [36 - i * 4, 70 + i * 2, 24 - i * 3, 86 + i * 2], 1.8);
  },
  'i-valise': (ctx) => {
    fillStroke(ctx, null, () => {
      ctx.moveTo(38, 30);
      ctx.lineTo(38, 18);
      ctx.lineTo(62, 18);
      ctx.lineTo(62, 30);
    }, 5);
    rect(ctx, TONES.leather, 10, 30, 80, 56);
    for (const x of [28, 72]) rect(ctx, PALETTE.woodDark, x - 4, 30, 8, 56, 3);
    // travel labels from twenty years of harbours
    rect(ctx, PALETTE.linen, 38, 44, 18, 12, 2.5);
    circle(ctx, PALETTE.light, 50, 72, 7, 2.5);
    rect(ctx, PALETTE.sky, 78, 38, 10, 14, 2.5);
  },
  'i-sums': (ctx) => {
    rect(ctx, PALETTE.linen, 14, 10, 72, 80);
    ctx.fillStyle = INK;
    ctx.textAlign = 'right';
    ctx.font = `700 14px 'Courier Prime', 'DejaVu Sans Mono', monospace`;
    ctx.fillText('7 249', 76, 30);
    ctx.fillText('× 863', 76, 46);
    line(ctx, [30, 52, 78, 52], 2.6);
    ctx.fillText('6 255…', 78, 68);
    rules(ctx, 22, 78, 76, 84, 8);
  },
  'i-palette': (ctx) => {
    fillStroke(ctx, PALETTE.wood, () => {
      ctx.moveTo(50, 12);
      ctx.bezierCurveTo(88, 12, 96, 54, 78, 70);
      ctx.bezierCurveTo(64, 82, 58, 64, 46, 76);
      ctx.bezierCurveTo(36, 88, 8, 80, 8, 50);
      ctx.bezierCurveTo(8, 28, 26, 12, 50, 12);
      ctx.closePath();
    });
    circle(ctx, PALETTE.paper, 30, 56, 7, 3);
    const blobs: [number, number, string][] = [[34, 28, TONES.aubergine], [54, 24, PALETTE.accent], [72, 32, PALETTE.light], [76, 52, TONES.cobalt], [20, 38, PALETTE.linen]];
    for (const [x, y, c] of blobs) circle(ctx, c, x, y, 6.5, 3);
  },
  'i-elevation': (ctx) => {
    // Valène's drawing of the building, every window a room
    rect(ctx, PALETTE.linen, 10, 8, 80, 86);
    poly(ctx, PALETTE.roof, [22, 26, 30, 16, 70, 16, 78, 26], 2.6);
    rect(ctx, null, 22, 26, 56, 60, 2.6);
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 4; c++) {
        const lit = (r * 4 + c) % 5 === 2;
        rect(ctx, lit ? PALETTE.light : PALETTE.paper, 26 + c * 13, 30 + r * 11, 8, 7, 1.6);
      }
    }
  },
  'i-teacup': (ctx) => {
    fillStroke(ctx, PALETTE.linen, () => ctx.ellipse(50, 78, 38, 9, 0, 0, Math.PI * 2));
    fillStroke(ctx, PALETTE.linen, () => {
      ctx.moveTo(22, 40);
      ctx.lineTo(78, 40);
      ctx.quadraticCurveTo(76, 76, 50, 76);
      ctx.quadraticCurveTo(24, 76, 22, 40);
      ctx.closePath();
    });
    fillStroke(ctx, null, () => ctx.ellipse(84, 52, 8, 10, 0, -Math.PI / 2, Math.PI / 2));
    fillStroke(ctx, PALETTE.wood, () => ctx.ellipse(50, 40, 28, 5, 0, 0, Math.PI * 2), 3);
    line(ctx, [30, 56, 70, 56], 3, TONES.rose);
  },
  'i-letter': (ctx) => {
    rect(ctx, PALETTE.linen, 10, 24, 80, 54);
    line(ctx, [10, 24, 50, 56, 90, 24], 3);
    circle(ctx, PALETTE.accent, 50, 56, 9, 3);
  },
  'i-mirror': (ctx) => {
    rect(ctx, PALETTE.brass, 44, 62, 12, 32);
    fillStroke(ctx, PALETTE.brass, () => ctx.ellipse(50, 36, 26, 30, 0, 0, Math.PI * 2));
    fillStroke(ctx, TONES.glass, () => ctx.ellipse(50, 36, 19, 23, 0, 0, Math.PI * 2), 3);
    line(ctx, [40, 26, 46, 18], 3, PALETTE.linen);
  },
};

export const GLYPH_IDS: readonly string[] = Object.keys(GLYPHS);

export function hasGlyph(id: GlyphId): boolean {
  return id in GLYPHS;
}

export function drawGlyph(ctx: Ctx, id: GlyphId, size: number) {
  ctx.save();
  ctx.scale(size / 100, size / 100);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = LW;
  (GLYPHS[id] ?? missing)(ctx);
  ctx.restore();
}

function missing(ctx: Ctx) {
  ctx.setLineDash([6, 4]);
  rect(ctx, null, 20, 20, 60, 60);
  ctx.setLineDash([]);
}
