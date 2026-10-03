// Parametric residents: full-length frozen pose, bust, window silhouette. Canvas 2D only.
// Figures face +x in three-quarter view; one ink weight, flat fills, one shadow step.
import { PALETTE, TONES } from '../palette';
import type { CastMember, Costume } from '../cast';

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

/** Full-length figure canvas size (before the paper border). Feet rest on y = FIGURE_H - FOOT_PAD. */
export const FIGURE_W = 520;
export const FIGURE_H = 1000;
const FOOT_PAD = 40;

const INK = PALETTE.ink;
const LW = 7;

// Body landmarks in figure units: feet at y = 0, up is negative.
const ANKLE = -34;
const HIP = -440;
const SHOULDER = -688;
const HEAD_Y = -800;

const HEM: Record<Costume, { y: number; flare: number }> = {
  frockcoat: { y: -236, flare: 1.04 },
  labcoat: { y: -250, flare: 1.08 },
  cardiganApron: { y: -404, flare: 0.98 },
  housecoatApron: { y: -150, flare: 1.4 },
  waistcoat: { y: -424, flare: 0.96 },
  smock: { y: -318, flare: 1.32 },
  dress: { y: -160, flare: 1.34 },
};

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = amt < 0 ? c * (1 + amt) : c + (255 - c) * amt;
    return Math.max(0, Math.min(255, Math.round(v)));
  });
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}

function offscreen(w: number, h: number, draw: (ctx: Ctx) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  return c;
}

function fs(ctx: Ctx, fill: string | null, path: () => void, lw = LW) {
  ctx.beginPath();
  path();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

/** A limb: polyline with an ink outline, drawn as a fat ink stroke under a thinner fill stroke. */
function limb(ctx: Ctx, pts: Pt[], width: number, fill: string) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (const p of pts.slice(1)) ctx.lineTo(...p);
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  path();
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + LW * 2;
  ctx.stroke();
  path();
  ctx.strokeStyle = fill;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.strokeStyle = INK;
}

function hand(ctx: Ctx, p: Pt, fill: string) {
  fs(ctx, fill, () => ctx.ellipse(p[0], p[1], 21, 18, 0.3, 0, Math.PI * 2));
}

function line(ctx: Ctx, pts: Pt[], lw = LW, color: string = INK) {
  ctx.beginPath();
  ctx.moveTo(...pts[0]);
  for (const p of pts.slice(1)) ctx.lineTo(...p);
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.strokeStyle = INK;
}

// ── head ────────────────────────────────────────────────────────────────────

/** Head centred at the origin, roughly 140 wide × 170 tall, facing +x. */
export function drawHead(ctx: Ctx, m: CastMember) {
  const h = m.head;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (h.hair === 'bun') fs(ctx, h.hairColor, () => ctx.arc(-58, -46, 27, 0, Math.PI * 2));
  if (h.hair === 'headscarf') {
    // knot of the scarf behind the head
    fs(ctx, TONES.scarf, () => {
      ctx.moveTo(-50, 30);
      ctx.lineTo(-92, 48);
      ctx.lineTo(-80, 70);
      ctx.lineTo(-44, 50);
      ctx.closePath();
    });
  }
  // ear
  fs(ctx, h.skin, () => ctx.ellipse(-44, 16, 14, 22, 0, 0, Math.PI * 2));
  // face and skull
  fs(ctx, h.skin, () => {
    ctx.moveTo(-50, -30);
    ctx.quadraticCurveTo(-40, -82, 12, -80);
    ctx.quadraticCurveTo(70, -76, 64, -10);
    ctx.lineTo(82, 22);
    ctx.lineTo(64, 30);
    ctx.quadraticCurveTo(60, 76, 8, 80);
    ctx.quadraticCurveTo(-48, 78, -50, -30);
    ctx.closePath();
  });
  // cheek shadow on the far side
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-50, -30);
  ctx.quadraticCurveTo(-40, -82, 12, -80);
  ctx.quadraticCurveTo(70, -76, 64, -10);
  ctx.lineTo(82, 22);
  ctx.lineTo(64, 30);
  ctx.quadraticCurveTo(60, 76, 8, 80);
  ctx.quadraticCurveTo(-48, 78, -50, -30);
  ctx.clip();
  ctx.fillStyle = shade(h.skin, -0.12);
  ctx.fillRect(-60, -90, 30, 180);
  ctx.restore();

  // hair
  const hairPaths: Record<string, () => void> = {
    swept: () => {
      ctx.moveTo(-54, 10);
      ctx.quadraticCurveTo(-64, -62, -8, -86);
      ctx.quadraticCurveTo(46, -94, 68, -46);
      ctx.quadraticCurveTo(28, -64, -12, -54);
      ctx.quadraticCurveTo(-32, -38, -32, 8);
      ctx.closePath();
    },
    thinning: () => {
      ctx.moveTo(-54, 14);
      ctx.quadraticCurveTo(-60, -40, -30, -64);
      ctx.lineTo(-20, -52);
      ctx.quadraticCurveTo(-36, -28, -32, 14);
      ctx.closePath();
    },
    bald: () => {
      ctx.moveTo(-54, 22);
      ctx.quadraticCurveTo(-58, -10, -42, -32);
      ctx.lineTo(-32, -22);
      ctx.quadraticCurveTo(-40, 0, -34, 24);
      ctx.closePath();
    },
    fringe: () => {
      ctx.moveTo(-56, 26);
      ctx.quadraticCurveTo(-64, -44, -20, -68);
      ctx.lineTo(-8, -56);
      ctx.quadraticCurveTo(-40, -30, -32, 28);
      ctx.closePath();
    },
    bun: () => {
      ctx.moveTo(-54, 4);
      ctx.quadraticCurveTo(-56, -80, 10, -86);
      ctx.quadraticCurveTo(72, -82, 66, -32);
      ctx.quadraticCurveTo(22, -58, -26, -40);
      ctx.lineTo(-30, 6);
      ctx.closePath();
    },
    headscarf: () => {
      ctx.moveTo(-60, 40);
      ctx.quadraticCurveTo(-72, -84, 10, -92);
      ctx.quadraticCurveTo(80, -90, 72, -18);
      ctx.lineTo(60, -24);
      ctx.quadraticCurveTo(30, -52, -18, -42);
      ctx.quadraticCurveTo(-38, -10, -38, 44);
      ctx.closePath();
    },
  };
  fs(ctx, h.hair === 'headscarf' ? TONES.scarf : h.hairColor, hairPaths[h.hair]);
  if (h.hair === 'headscarf') {
    // dots on the scarf and a curl escaping at the temple
    ctx.fillStyle = PALETTE.linen;
    for (const [x, y] of [[-30, -60], [6, -74], [40, -66], [-46, -20], [-12, -50]] as Pt[]) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    fs(ctx, h.hairColor, () => ctx.ellipse(56, -18, 12, 8, 0.4, 0, Math.PI * 2), 5);
  }
  if (h.hair === 'thinning') {
    line(ctx, [[-20, -70], [10, -82], [40, -74]], 4);
    line(ctx, [[-14, -62], [20, -74]], 4);
  }
  if (h.hat === 'beret') {
    fs(ctx, TONES.graphite, () => ctx.ellipse(2, -78, 70, 24, -0.12, 0, Math.PI * 2));
    fs(ctx, TONES.graphite, () => ctx.ellipse(6, -104, 7, 10, 0, 0, Math.PI * 2), 5);
  }

  // features
  if (h.beard) {
    fs(ctx, h.hairColor, () => {
      ctx.moveTo(-34, 22);
      ctx.quadraticCurveTo(-36, 104, 22, 112);
      ctx.quadraticCurveTo(72, 104, 66, 36);
      ctx.lineTo(44, 40);
      ctx.quadraticCurveTo(14, 56, -14, 26);
      ctx.closePath();
    });
  }
  if (h.moustache || h.beard) {
    fs(ctx, h.hairColor, () => {
      ctx.moveTo(34, 38);
      ctx.quadraticCurveTo(58, 26, 82, 40);
      ctx.quadraticCurveTo(74, 48, 58, 42);
      ctx.quadraticCurveTo(44, 48, 34, 38);
      ctx.closePath();
    }, 5);
  } else {
    line(ctx, [[38, 52], [58, 48]], 5);
  }
  if (h.glasses === 'dark') {
    fs(ctx, INK, () => ctx.ellipse(40, 0, 20, 17, 0, 0, Math.PI * 2), 5);
    line(ctx, [[30, -6], [38, -10]], 4, PALETTE.linen);
    line(ctx, [[20, -2], [-34, 4]], 5);
  } else {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(40, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    line(ctx, [[26, -22], [56, -20]], 5, h.hair === 'headscarf' ? INK : shade(h.hairColor, -0.35));
    if (h.glasses === 'round') {
      fs(ctx, null, () => ctx.arc(40, 0, 18, 0, Math.PI * 2), 5);
      line(ctx, [[22, -2], [-34, 4]], 5);
    }
  }
}

// ── body ────────────────────────────────────────────────────────────────────

function torsoPath(ctx: Ctx, w: number, hemY: number, flare: number) {
  const sx = 72 * w;
  const hx = 70 * w * flare;
  ctx.moveTo(-sx, SHOULDER + 12);
  ctx.quadraticCurveTo(0, SHOULDER - 12, sx, SHOULDER + 12);
  ctx.quadraticCurveTo(sx + 22, SHOULDER + 50, sx + 12, -580);
  ctx.quadraticCurveTo(62 * w, -500, hx + 4, hemY);
  ctx.quadraticCurveTo(0, hemY + 16, -hx - 8, hemY);
  ctx.quadraticCurveTo(-64 * w, -500, -sx - 14, -580);
  ctx.quadraticCurveTo(-sx - 22, SHOULDER + 50, -sx, SHOULDER + 12);
  ctx.closePath();
}

function torso(ctx: Ctx, m: CastMember) {
  const w = m.build.width;
  const { y: hemY, flare } = HEM[m.costume];
  const base = m.costume === 'waistcoat' ? PALETTE.linen : m.coat;
  fs(ctx, base, () => torsoPath(ctx, w, hemY, flare));
  ctx.save();
  ctx.beginPath();
  torsoPath(ctx, w, hemY, flare);
  ctx.clip();
  ctx.fillStyle = shade(base, -0.16);
  ctx.fillRect(-140 * w, SHOULDER - 30, 62 * w, 700);

  const neck = SHOULDER - 2;
  switch (m.costume) {
    case 'frockcoat': {
      fs(ctx, m.trim, () => {
        ctx.moveTo(-26, neck);
        ctx.lineTo(34, neck);
        ctx.lineTo(8, -560);
        ctx.closePath();
      });
      fs(ctx, m.trim, () => {
        ctx.moveTo(-6, neck + 6);
        ctx.quadraticCurveTo(10, neck + 30, 22, neck + 6);
        ctx.lineTo(16, neck + 60);
        ctx.lineTo(0, neck + 60);
        ctx.closePath();
      }, 5);
      line(ctx, [[-30, neck], [4, -556]]);
      line(ctx, [[38, neck], [12, -556]]);
      line(ctx, [[6, -556], [2, hemY]], 5);
      for (const y of [-530, -480]) fs(ctx, INK, () => ctx.arc(20, y, 6, 0, Math.PI * 2), 0);
      break;
    }
    case 'labcoat': {
      line(ctx, [[-24, neck], [10, -520]]);
      line(ctx, [[36, neck], [12, -520]]);
      line(ctx, [[11, -520], [8, hemY]], 5);
      fs(ctx, shade(m.coat, -0.06), () => ctx.rect(30, -560, 40, 46), 5);
      line(ctx, [[40, -572], [40, -548]], 6, TONES.cobalt);
      line(ctx, [[54, -576], [54, -548]], 6, PALETTE.accent);
      fs(ctx, shade(m.coat, -0.06), () => ctx.rect(-50 * w, -420, 44, 40), 5);
      break;
    }
    case 'cardiganApron': {
      line(ctx, [[8, neck], [6, hemY]], 5);
      for (const y of [-600, -540]) fs(ctx, INK, () => ctx.arc(18, y, 5, 0, Math.PI * 2), 0);
      // leather apron from chest to knee
      fs(ctx, m.trim, () => {
        ctx.moveTo(-34, -640);
        ctx.lineTo(56, -640);
        ctx.lineTo(70 * w, -250);
        ctx.lineTo(-56 * w, -250);
        ctx.closePath();
      });
      line(ctx, [[-30, -640], [-14, neck]], 6);
      line(ctx, [[52, -640], [30, neck]], 6);
      fs(ctx, shade(m.trim, -0.15), () => ctx.rect(-6, -470, 46, 34), 5);
      break;
    }
    case 'housecoatApron': {
      fs(ctx, m.trim, () => {
        ctx.moveTo(-30, -630);
        ctx.lineTo(50, -630);
        ctx.lineTo(56, -500);
        ctx.quadraticCurveTo(90 * w, -320, 86 * w, -186);
        ctx.lineTo(-60 * w, -186);
        ctx.quadraticCurveTo(-64 * w, -320, -30, -500);
        ctx.closePath();
      });
      line(ctx, [[-30, -500], [-90 * w, -496]], 6);
      fs(ctx, shade(m.trim, -0.08), () => ctx.rect(-4, -420, 56, 44), 5);
      fs(ctx, PALETTE.linen, () => {
        ctx.moveTo(-34, neck);
        ctx.lineTo(4, neck + 34);
        ctx.lineTo(40, neck);
      }, 5);
      break;
    }
    case 'waistcoat': {
      fs(ctx, m.coat, () => {
        ctx.moveTo(-70 * w, SHOULDER + 18);
        ctx.lineTo(-18, SHOULDER + 18);
        ctx.lineTo(8, -560);
        ctx.lineTo(30, SHOULDER + 18);
        ctx.lineTo(72 * w, SHOULDER + 18);
        ctx.lineTo(70 * w * 0.98, hemY + 6);
        ctx.lineTo(8, hemY + 30);
        ctx.lineTo(-70 * w, hemY + 6);
        ctx.closePath();
      });
      for (const y of [-540, -500, -460]) fs(ctx, PALETTE.brass, () => ctx.arc(14, y, 6, 0, Math.PI * 2), 3);
      // watch chain
      line(ctx, [[14, -500], [50, -480], [64, -496]], 3.5, PALETTE.brass);
      fs(ctx, INK, () => {
        ctx.moveTo(-14, neck + 4);
        ctx.lineTo(4, neck + 14);
        ctx.lineTo(-14, neck + 24);
        ctx.closePath();
        ctx.moveTo(26, neck + 4);
        ctx.lineTo(8, neck + 14);
        ctx.lineTo(26, neck + 24);
        ctx.closePath();
      }, 0);
      break;
    }
    case 'smock': {
      line(ctx, [[-60 * w, -610], [70 * w, -610]], 5);
      for (let i = 0; i < 5; i++) line(ctx, [[-40 + i * 22, -606], [-46 + i * 24, -560]], 3);
      const flecks: [number, number, string][] = [[30, -470, PALETTE.accent], [-20, -420, TONES.cobalt], [50, -380, PALETTE.light], [-48, -520, PALETTE.green], [12, -350, TONES.cobalt]];
      for (const [x, y, c] of flecks) fs(ctx, c, () => ctx.ellipse(x, y, 9, 6, 0.5, 0, Math.PI * 2), 3);
      // neckerchief
      fs(ctx, PALETTE.accent, () => {
        ctx.moveTo(-30, neck);
        ctx.lineTo(40, neck);
        ctx.lineTo(18, neck + 70);
        ctx.closePath();
      }, 5);
      break;
    }
    case 'dress': {
      line(ctx, [[-66 * w, -500], [66 * w, -500]], 10);
      for (const x of [-30, 10, 50]) line(ctx, [[x, -490], [x * 1.4, hemY + 6]], 3);
      fs(ctx, m.trim, () => {
        ctx.moveTo(-36, neck);
        ctx.quadraticCurveTo(4, neck + 46, 44, neck);
        ctx.quadraticCurveTo(4, neck + 20, -36, neck);
      }, 5);
      break;
    }
  }
  ctx.restore();
  fs(ctx, null, () => torsoPath(ctx, w, hemY, flare));
}

function legs(ctx: Ctx, m: CastMember) {
  const w = m.build.width;
  const skirt = m.costume === 'housecoatApron' || m.costume === 'dress';
  const legW = skirt ? 34 : 50 * Math.sqrt(w);
  const top = skirt ? HEM[m.costume].y - 10 : HIP + 20;
  const fill = m.trousers;
  limb(ctx, [[-22 * w, top], [-26 * w, -240], [-30, ANKLE]], legW, shade(fill, -0.12));
  limb(ctx, [[22 * w, top], [24 * w, -240], [30, ANKLE]], legW, fill);
  for (const x of [-30, 30]) {
    fs(ctx, INK, () => {
      ctx.moveTo(x - 30, ANKLE - 6);
      ctx.lineTo(x + 34, ANKLE - 8);
      ctx.quadraticCurveTo(x + 56, ANKLE + 4, x + 54, 0);
      ctx.lineTo(x - 30, 0);
      ctx.closePath();
    }, 4);
  }
}

function sleeveColor(m: CastMember) {
  return m.costume === 'waistcoat' ? PALETTE.linen : m.coat;
}

interface ArmSet {
  back: Pt[];
  front: Pt[];
  /** Props drawn behind the back arm / in front of everything. */
  behind?: (ctx: Ctx) => void;
  inFront?: (ctx: Ctx) => void;
}

function wPiece(ctx: Ctx, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.3);
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  const pts: Pt[] = [[-26, -16], [-13, 18], [0, -4], [13, 18], [26, -16]];
  line(ctx, pts, 20, INK);
  line(ctx, pts, 11, PALETTE.sea);
  ctx.restore();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function arms(m: CastMember): ArmSet {
  const w = m.build.width;
  const sb: Pt = [-46 * w, SHOULDER + 34];
  const sf: Pt = [44 * w, SHOULDER + 34];
  const hang: Pt[] = [sb, [-60 * w, -560], [-56 * w, -432]];
  switch (m.pose) {
    case 'reach':
      return {
        back: hang,
        front: [sf, [118, -604], [212, -566]],
        inFront: (ctx) => wPiece(ctx, 246, -590),
      };
    case 'saw':
      return {
        back: [sb, [-10, -560], [86, -584]],
        front: [sf, [86, -536], [166, -606]],
        inFront: (ctx) => {
          // the plywood board being cut, then the fret saw tilted through it
          fs(ctx, PALETTE.sky, () => ctx.rect(196, -604, 130, 16), 5);
          ctx.save();
          ctx.translate(176, -612);
          ctx.rotate(-0.35);
          limb(ctx, [[0, -10], [0, -130], [120, -130], [120, -10]], 7, TONES.steel);
          const teeth: Pt[] = [];
          for (let i = 0; i <= 12; i++) teeth.push([i * 10, -10 + (i % 2 ? 5 : -2)]);
          line(ctx, teeth, 3);
          fs(ctx, PALETTE.wood, () => {
            ctx.moveTo(-12, -8);
            ctx.lineTo(12, -8);
            ctx.lineTo(9, 52);
            ctx.quadraticCurveTo(0, 62, -9, 52);
            ctx.closePath();
          }, 5);
          ctx.restore();
        },
      };
    case 'pour':
      return {
        back: [sb, [-6, -560], [96, -560]],
        front: [sf, [110, -584], [168, -660]],
        behind: (ctx) => {
          // developing tray held level by the bandaged hand
          fs(ctx, TONES.steel, () => ctx.rect(70, -556, 120, 16), 5);
        },
        inFront: (ctx) => {
          ctx.save();
          ctx.translate(188, -690);
          ctx.rotate(0.7);
          fs(ctx, TONES.glass, () => {
            ctx.moveTo(-10, -40);
            ctx.lineTo(-10, -12);
            ctx.lineTo(-30, 26);
            ctx.lineTo(30, 26);
            ctx.lineTo(10, -12);
            ctx.lineTo(10, -40);
            ctx.closePath();
          }, 5);
          ctx.restore();
          line(ctx, [[218, -676], [226, -640], [230, -572]], 4, TONES.glass);
        },
      };
    case 'sweep':
      return {
        back: [sb, [26, -568], [102, -508]],
        front: [sf, [72, -500], [124, -414]],
        behind: (ctx) => {
          line(ctx, [[58, -704], [206, -64]], 9, PALETTE.wood);
          fs(ctx, PALETTE.brass, () => {
            ctx.moveTo(186, -110);
            ctx.lineTo(236, -116);
            ctx.lineTo(240, -90);
            ctx.lineTo(186, -84);
            ctx.closePath();
          }, 5);
          fs(ctx, PALETTE.light, () => {
            ctx.moveTo(180, -86);
            ctx.lineTo(246, -92);
            ctx.lineTo(280, 0);
            ctx.lineTo(150, 0);
            ctx.closePath();
          }, 5);
          for (let i = 0; i < 4; i++) line(ctx, [[190 + i * 14, -80], [176 + i * 26, -6]], 3);
        },
      };
    case 'valise':
      return {
        back: hang,
        front: [sf, [54, -560], [58, -420]],
        inFront: (ctx) => {
          line(ctx, [[34, -398], [34, -420], [82, -420], [82, -398]], 8);
          fs(ctx, TONES.leather, () => ctx.rect(-18, -398, 150, 150));
          for (const x of [12, 102]) fs(ctx, PALETTE.woodDark, () => ctx.rect(x - 6, -398, 12, 150), 4);
          fs(ctx, PALETTE.linen, () => ctx.rect(36, -360, 40, 26), 4);
          fs(ctx, PALETTE.sky, () => ctx.rect(70, -310, 30, 34), 4);
        },
      };
    case 'paint':
      return {
        back: [sb, [-80 * w, -560], [-34, -500]],
        front: [sf, [126, -640], [186, -742]],
        behind: (ctx) => {
          fs(ctx, PALETTE.wood, () => ctx.ellipse(-54, -488, 70, 40, -0.2, 0, Math.PI * 2));
          for (const [x, y, c] of [[-92, -500, PALETTE.accent], [-64, -514, TONES.cobalt], [-30, -506, PALETTE.light]] as [number, number, string][]) {
            fs(ctx, c, () => ctx.arc(x, y, 9, 0, Math.PI * 2), 4);
          }
        },
        inFront: (ctx) => {
          line(ctx, [[186, -742], [236, -800]], 7, PALETTE.wood);
          fs(ctx, TONES.cobalt, () => ctx.ellipse(242, -808, 9, 14, 0.7, 0, Math.PI * 2), 4);
        },
      };
    case 'tray':
      return {
        back: hang,
        front: [sf, [74, -544], [150, -544]],
        inFront: (ctx) => {
          fs(ctx, PALETTE.brass, () => ctx.rect(96, -566, 140, 12));
          fs(ctx, PALETTE.linen, () => {
            ctx.moveTo(146, -604);
            ctx.lineTo(190, -604);
            ctx.quadraticCurveTo(188, -566, 168, -566);
            ctx.quadraticCurveTo(148, -566, 146, -604);
            ctx.closePath();
          }, 5);
        },
      };
  }
}

/** Full-length frozen pose in a FIGURE_W × FIGURE_H canvas, transparent background. Deceased residents come out sepia. */
export function drawFigure(ctx: Ctx, m: CastMember) {
  if (!m.deceased) {
    drawFigureRaw(ctx, m);
    return;
  }
  ctx.drawImage(
    offscreen(FIGURE_W, FIGURE_H, (c) => {
      drawFigureRaw(c, m);
      sepia(c, FIGURE_W, FIGURE_H);
    }),
    0,
    0
  );
}

function sepia(ctx: Ctx, w: number, h: number) {
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = TONES.sepia;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function keyRing(ctx: Ctx, x: number, y: number) {
  line(ctx, [[x, y - 60], [x, y - 22]], 4);
  fs(ctx, null, () => ctx.arc(x, y, 20, 0, Math.PI * 2), 5);
  for (const [dx, c] of [[-10, PALETTE.brass], [6, TONES.steel], [18, PALETTE.brass]] as [number, string][]) {
    fs(ctx, c, () => ctx.rect(x + dx - 4, y + 14, 8, 44), 4);
    fs(ctx, c, () => ctx.rect(x + dx + 2, y + 46, 9, 7), 3);
  }
}

function drawFigureRaw(ctx: Ctx, m: CastMember) {
  ctx.save();
  const k = 0.95 * m.build.height;
  ctx.translate(FIGURE_W / 2 - 50, FIGURE_H - FOOT_PAD);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;

  const a = arms(m);
  legs(ctx, m);
  // the upper body leans forward around the hip
  ctx.save();
  ctx.translate(0, HIP);
  ctx.rotate(m.build.stoop * 0.16);
  ctx.translate(0, -HIP);
  if (m.costume === 'frockcoat') {
    // coat tails behind the legs
    fs(ctx, shade(m.coat, -0.2), () => {
      ctx.moveTo(-70 * m.build.width, -500);
      ctx.lineTo(-92 * m.build.width, -200);
      ctx.lineTo(-30, -214);
      ctx.lineTo(-20, -480);
      ctx.closePath();
    });
  }
  a.behind?.(ctx);
  const sleeve = sleeveColor(m);
  limb(ctx, a.back, 40, shade(sleeve, -0.18));
  hand(ctx, a.back[a.back.length - 1], m.costume === 'labcoat' ? TONES.bandage : m.head.skin);
  torso(ctx, m);
  if (m.costume === 'housecoatApron') keyRing(ctx, -64 * m.build.width, -440);
  // neck and head
  const lean = m.build.stoop * 40;
  fs(ctx, m.head.skin, () => ctx.rect(-14 + lean * 0.4, SHOULDER - 46, 40, 56));
  ctx.save();
  ctx.translate(10 + lean, HEAD_Y + lean * 0.4);
  ctx.rotate(m.build.stoop * 0.22);
  drawHead(ctx, m);
  ctx.restore();
  limb(ctx, a.front, 42, sleeve);
  hand(ctx, a.front[a.front.length - 1], m.head.skin);
  a.inFront?.(ctx);
  ctx.restore();
  ctx.restore();
}

// ── bust and silhouette ─────────────────────────────────────────────────────

const BUST = 300;

function bustCanvas(m: CastMember): HTMLCanvasElement {
  return offscreen(BUST, BUST, (ctx) => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const base = m.costume === 'waistcoat' ? PALETTE.linen : m.coat;
    const shoulders = () => {
      ctx.moveTo(30, BUST + 10);
      ctx.quadraticCurveTo(34, 236, 108, 224);
      ctx.lineTo(196, 224);
      ctx.quadraticCurveTo(270, 236, 274, BUST + 10);
      ctx.closePath();
    };
    fs(ctx, m.head.skin, () => ctx.rect(132, 180, 44, 56));
    fs(ctx, base, shoulders);
    ctx.save();
    ctx.beginPath();
    shoulders();
    ctx.clip();
    ctx.fillStyle = shade(base, -0.16);
    ctx.fillRect(20, 200, 60, 120);
    switch (m.costume) {
      case 'frockcoat':
        fs(ctx, m.trim, () => {
          ctx.moveTo(126, 224);
          ctx.lineTo(186, 224);
          ctx.lineTo(160, 310);
          ctx.closePath();
        });
        line(ctx, [[120, 224], [154, 310]]);
        line(ctx, [[192, 224], [164, 310]]);
        break;
      case 'labcoat':
        line(ctx, [[124, 224], [156, 310]]);
        line(ctx, [[190, 224], [160, 310]]);
        line(ctx, [[206, 262], [206, 300]], 7, PALETTE.accent);
        break;
      case 'cardiganApron':
        fs(ctx, m.trim, () => ctx.rect(118, 262, 90, 60));
        line(ctx, [[124, 262], [134, 224]], 7);
        line(ctx, [[200, 262], [184, 224]], 7);
        break;
      case 'housecoatApron':
        fs(ctx, m.trim, () => ctx.rect(112, 270, 100, 60));
        fs(ctx, PALETTE.linen, () => {
          ctx.moveTo(122, 224);
          ctx.lineTo(154, 262);
          ctx.lineTo(190, 224);
        }, 5);
        break;
      case 'waistcoat':
        fs(ctx, m.coat, () => {
          ctx.moveTo(60, 236);
          ctx.lineTo(128, 226);
          ctx.lineTo(156, 300);
          ctx.lineTo(184, 226);
          ctx.lineTo(244, 236);
          ctx.lineTo(260, BUST + 10);
          ctx.lineTo(50, BUST + 10);
          ctx.closePath();
        });
        fs(ctx, INK, () => {
          ctx.moveTo(136, 226);
          ctx.lineTo(156, 238);
          ctx.lineTo(136, 250);
          ctx.closePath();
          ctx.moveTo(176, 226);
          ctx.lineTo(156, 238);
          ctx.lineTo(176, 250);
          ctx.closePath();
        }, 0);
        break;
      case 'smock':
        fs(ctx, PALETTE.accent, () => {
          ctx.moveTo(122, 224);
          ctx.lineTo(194, 224);
          ctx.lineTo(160, 300);
          ctx.closePath();
        }, 5);
        fs(ctx, TONES.cobalt, () => ctx.ellipse(230, 280, 9, 6, 0.5, 0, Math.PI * 2), 3);
        break;
      case 'dress':
        fs(ctx, m.trim, () => {
          ctx.moveTo(116, 224);
          ctx.quadraticCurveTo(156, 274, 196, 224);
        }, 5);
        break;
    }
    ctx.restore();
    fs(ctx, null, shoulders);
    ctx.save();
    ctx.translate(150, 124);
    ctx.scale(1.18, 1.18);
    drawHead(ctx, m);
    ctx.restore();
    // a photograph from before 1973: sepia over the drawing only
    if (m.deceased) sepia(ctx, BUST, BUST);
  });
}

/** Head-and-shoulders portrait in a size×size square, transparent background. */
export { bustCanvas };

export function drawBust(ctx: Ctx, m: CastMember, size: number) {
  ctx.drawImage(bustCanvas(m), 0, 0, size, size);
}

/** Full-length figure as one flat ink shape, for lit windows. */
export function silhouetteCanvas(m: CastMember): HTMLCanvasElement {
  const fig = offscreen(FIGURE_W, FIGURE_H, (ctx) => drawFigure(ctx, m));
  return offscreen(FIGURE_W, FIGURE_H, (ctx) => {
    ctx.drawImage(fig, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, FIGURE_W, FIGURE_H);
  });
}

/** Lit window with the resident's ink silhouette between curtains in their colour, in a w×h box. */
export function drawWindowSilhouette(ctx: Ctx, m: CastMember, w: number, h: number) {
  ctx.save();
  ctx.lineJoin = 'round';
  const f = Math.min(w, h) * 0.06;
  ctx.fillStyle = PALETTE.plaster;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = m.deceased ? PALETTE.paperDeep : PALETTE.light;
  ctx.fillRect(f, f, w - 2 * f, h - 2 * f);
  const sil = silhouetteCanvas(m);
  const sh = (h - 2 * f) * 0.92;
  const sw = (sh * FIGURE_W) / FIGURE_H;
  ctx.drawImage(sil, w / 2 - sw / 2, h - f - sh + sh * 0.04, sw, sh);
  // curtains in the signature colour
  ctx.fillStyle = m.color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  for (const side of [0, 1]) {
    ctx.beginPath();
    const x0 = side ? w - f : f;
    const x1 = side ? w - f - w * 0.2 : f + w * 0.2;
    ctx.moveTo(x0, f);
    ctx.lineTo(x1, f);
    ctx.quadraticCurveTo((x0 + x1) / 2, h * 0.55, x0 + (side ? -w * 0.04 : w * 0.04), h - f);
    ctx.lineTo(x0, h - f);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // glazing bars and frame
  ctx.lineWidth = Math.max(2, f * 0.5);
  ctx.beginPath();
  ctx.moveTo(w / 2, f);
  ctx.lineTo(w / 2, h - f);
  ctx.moveTo(f, h * 0.38);
  ctx.lineTo(w - f, h * 0.38);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeRect(f, f, w - 2 * f, h - 2 * f);
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  ctx.restore();
}
