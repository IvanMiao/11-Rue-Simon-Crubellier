import { PALETTE, TONES } from '../palette';
import { shade } from './people';

type DicePhase = 'hold' | 'shake' | 'open';
type Point = [number, number];

function outlined(ctx: CanvasRenderingContext2D, fill: string, draw: () => void, width = 4) {
  ctx.beginPath();
  draw();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = width;
  ctx.stroke();
}

function line(ctx: CanvasRenderingContext2D, points: Point[], width = 4, color: string = PALETTE.ink) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawDie(ctx: CanvasRenderingContext2D, x: number, y: number, value: number, angle = 0, shadow = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (shadow) {
    ctx.save();
    ctx.translate(4, 4);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.roundRect(-21, -21, 44, 44, 5);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = PALETTE.paper;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(-22, -22, 44, 44, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.ink;
  const points: Record<number, Point[]> = {
    1: [[0, 0]],
    2: [[-10, -10], [10, 10]],
    3: [[-10, -10], [0, 0], [10, 10]],
    4: [[-10, -10], [10, -10], [-10, 10], [10, 10]],
    5: [[-10, -10], [10, -10], [0, 0], [-10, 10], [10, 10]],
    6: [[-10, -12], [10, -12], [-10, 0], [10, 0], [-10, 12], [10, 12]],
  };
  for (const [px, py] of points[Math.max(1, Math.min(6, value))]) {
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCuff(ctx: CanvasRenderingContext2D, coatTone: string) {
  outlined(ctx, coatTone, () => {
    ctx.moveTo(128, -8);
    ctx.lineTo(292, -8);
    ctx.lineTo(281, 33);
    ctx.quadraticCurveTo(210, 44, 139, 33);
    ctx.closePath();
  });
  outlined(ctx, PALETTE.linen, () => {
    ctx.moveTo(137, 22);
    ctx.quadraticCurveTo(210, 31, 282, 22);
    ctx.lineTo(279, 38);
    ctx.quadraticCurveTo(210, 47, 140, 38);
    ctx.closePath();
  }, 3);
  line(ctx, [[151, 6], [151, 20]], 3, shade(coatTone, -0.18));
  line(ctx, [[269, 6], [269, 20]], 3, shade(coatTone, -0.18));
}

function drawFist(ctx: CanvasRenderingContext2D, coatTone: string, die1: number, die2: number) {
  drawCuff(ctx, coatTone);
  outlined(ctx, TONES.skinWarm, () => {
    ctx.moveTo(158, 30);
    ctx.quadraticCurveTo(210, 38, 261, 30);
    ctx.lineTo(270, 57);
    ctx.lineTo(150, 57);
    ctx.closePath();
  });

  outlined(ctx, TONES.skinWarm, () => {
    ctx.moveTo(112, 59);
    ctx.quadraticCurveTo(105, 43, 122, 40);
    ctx.quadraticCurveTo(133, 24, 151, 39);
    ctx.quadraticCurveTo(169, 22, 187, 39);
    ctx.quadraticCurveTo(207, 21, 226, 39);
    ctx.quadraticCurveTo(247, 25, 264, 44);
    ctx.quadraticCurveTo(295, 45, 309, 65);
    ctx.quadraticCurveTo(320, 88, 299, 104);
    ctx.quadraticCurveTo(279, 119, 241, 115);
    ctx.lineTo(128, 112);
    ctx.quadraticCurveTo(94, 108, 86, 87);
    ctx.quadraticCurveTo(80, 68, 112, 59);
    ctx.closePath();
  });

  ctx.fillStyle = shade(TONES.skinWarm, -0.14);
  ctx.beginPath();
  ctx.moveTo(108, 81);
  ctx.quadraticCurveTo(149, 100, 191, 96);
  ctx.lineTo(191, 111);
  ctx.lineTo(128, 109);
  ctx.quadraticCurveTo(99, 104, 108, 81);
  ctx.fill();

  for (const x of [141, 178, 215, 251]) {
    line(ctx, [[x, 48], [x + 3, 66], [x - 2, 77]], 3);
    line(ctx, [[x + 2, 88], [x + 15, 84], [x + 26, 88]], 2.5);
  }

  ctx.save();
  ctx.translate(210, 0);
  ctx.scale(1 / 1.18, 1);
  ctx.translate(-210, 0);
  drawDie(ctx, 192, 91, die1, -0.1);
  drawDie(ctx, 238, 93, die2, 0.12);
  ctx.restore();

  outlined(ctx, TONES.skinWarm, () => {
    ctx.moveTo(162, 69);
    ctx.quadraticCurveTo(207, 65, 258, 76);
    ctx.lineTo(254, 89);
    ctx.quadraticCurveTo(207, 82, 168, 86);
    ctx.closePath();
  }, 3);

  outlined(ctx, TONES.skinWarm, () => {
    ctx.moveTo(278, 49);
    ctx.quadraticCurveTo(307, 44, 326, 64);
    ctx.quadraticCurveTo(333, 77, 319, 87);
    ctx.lineTo(273, 101);
    ctx.quadraticCurveTo(259, 103, 251, 92);
    ctx.lineTo(224, 82);
    ctx.quadraticCurveTo(216, 73, 223, 64);
    ctx.quadraticCurveTo(230, 56, 244, 61);
    ctx.lineTo(277, 74);
    ctx.closePath();
  });
  line(ctx, [[260, 70], [276, 76], [287, 74]], 3);
}

function drawOpenHand(ctx: CanvasRenderingContext2D, coatTone: string) {
  drawCuff(ctx, coatTone);
  outlined(ctx, TONES.skinWarm, () => {
    ctx.moveTo(174, 31);
    ctx.quadraticCurveTo(210, 39, 247, 31);
    ctx.lineTo(252, 54);
    ctx.lineTo(169, 54);
    ctx.closePath();
  });

  outlined(ctx, TONES.skinWarm, () => {
    ctx.moveTo(177, 59);
    ctx.quadraticCurveTo(163, 44, 154, 25);
    ctx.lineTo(134, 2);
    ctx.quadraticCurveTo(126, -8, 116, 1);
    ctx.quadraticCurveTo(109, 10, 121, 26);
    ctx.lineTo(148, 67);
    ctx.quadraticCurveTo(134, 54, 124, 39);
    ctx.lineTo(96, 9);
    ctx.quadraticCurveTo(87, 0, 77, 8);
    ctx.quadraticCurveTo(69, 17, 82, 34);
    ctx.lineTo(121, 82);
    ctx.quadraticCurveTo(106, 70, 93, 60);
    ctx.lineTo(65, 39);
    ctx.quadraticCurveTo(52, 31, 45, 42);
    ctx.quadraticCurveTo(39, 51, 54, 65);
    ctx.lineTo(115, 94);
    ctx.quadraticCurveTo(149, 112, 191, 99);
    ctx.quadraticCurveTo(227, 114, 261, 92);
    ctx.lineTo(345, 61);
    ctx.quadraticCurveTo(359, 52, 353, 39);
    ctx.quadraticCurveTo(347, 28, 331, 36);
    ctx.lineTo(281, 63);
    ctx.quadraticCurveTo(292, 48, 301, 31);
    ctx.lineTo(319, 7);
    ctx.quadraticCurveTo(327, -5, 316, -12);
    ctx.quadraticCurveTo(305, -18, 296, -5);
    ctx.lineTo(263, 37);
    ctx.quadraticCurveTo(268, 19, 267, 4);
    ctx.lineTo(265, -13);
    ctx.quadraticCurveTo(263, -28, 250, -27);
    ctx.quadraticCurveTo(237, -26, 239, -9);
    ctx.lineTo(237, 43);
    ctx.quadraticCurveTo(226, 29, 219, 14);
    ctx.lineTo(211, -3);
    ctx.quadraticCurveTo(204, -17, 192, -11);
    ctx.quadraticCurveTo(180, -6, 188, 12);
    ctx.lineTo(204, 55);
    ctx.closePath();
  });

  line(ctx, [[115, 86], [153, 101], [188, 91]], 4, shade(TONES.skinWarm, -0.14));
  line(ctx, [[205, 89], [239, 99], [280, 80]], 4, shade(TONES.skinWarm, -0.14));
  line(ctx, [[167, 60], [177, 78]], 3, shade(TONES.skinWarm, -0.14));
  line(ctx, [[222, 57], [216, 77]], 3, shade(TONES.skinWarm, -0.14));
}

export function drawDiceHand(
  ctx: CanvasRenderingContext2D,
  {
    phase,
    tick,
    die1,
    die2,
    coatTone = TONES.navy,
  }: { phase: DicePhase; tick: number; die1: number; die2: number; coatTone?: string }
) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const scale = Math.min(width / 420, height / 150);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate((width - 420 * scale) / 2, (height - 150 * scale) / 2);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (phase === 'open') {
    ctx.save();
    ctx.translate(0, 24);
    ctx.scale(1, 0.82);
    drawOpenHand(ctx, coatTone);
    ctx.restore();
    drawDie(ctx, 182, 124, die1, -0.08, true);
    drawDie(ctx, 240, 119, die2, 0.11, true);
    ctx.restore();
    return;
  }

  const shakeX = phase === 'shake' ? Math.sin(tick * 1.8) * 8 : 0;
  const shakeY = phase === 'shake' ? Math.cos(tick * 1.45) * 4 : 0;
  const shakeAngle = phase === 'shake' ? Math.sin(tick * 1.1) * 0.07 : 0;
  ctx.save();
  ctx.translate(210 + shakeX, shakeY);
  ctx.rotate(shakeAngle);
  ctx.translate(-210, 0);
  ctx.translate(210, 0);
  ctx.scale(1.18, 1);
  ctx.translate(-210, 0);

  if (phase === 'shake') {
    line(ctx, [[88, 54], [71, 46], [61, 34]], 3);
    line(ctx, [[99, 105], [80, 111], [68, 125]], 3);
    line(ctx, [[322, 53], [342, 45], [353, 34]], 3);
  }
  drawFist(ctx, coatTone, die1, die2);
  ctx.restore();
  ctx.restore();
}
