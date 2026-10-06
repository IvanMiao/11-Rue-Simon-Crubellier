import { CAST } from '../cast';
import { PALETTE, TONES } from '../palette';
import { shade } from './people';

export type BartleboothHandPose = 'closed' | 'half' | 'open';

function shape(ctx: CanvasRenderingContext2D, fill: string, draw: () => void, width = 3.5) {
  ctx.beginPath();
  draw();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function sleeve(ctx: CanvasRenderingContext2D) {
  const coat = CAST.bartlebooth.coat;
  shape(ctx, coat, () => {
    ctx.moveTo(4, 78);
    ctx.lineTo(79, 46);
    ctx.lineTo(126, 111);
    ctx.lineTo(37, 155);
    ctx.closePath();
  });
  ctx.beginPath();
  ctx.moveTo(79, 51);
  ctx.quadraticCurveTo(93, 80, 113, 108);
  ctx.lineWidth = 3;
  ctx.strokeStyle = shade(coat, -0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(84, 49);
  ctx.quadraticCurveTo(98, 78, 118, 105);
  ctx.lineWidth = 5;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
}

function drawKnuckle(ctx: CanvasRenderingContext2D, x: number, y: number, width = 18) {
  ctx.beginPath();
  ctx.moveTo(x - width / 2, y + 1);
  ctx.quadraticCurveTo(x, y - 5, x + width / 2, y + 1);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = shade(CAST.bartlebooth.head.skin, -0.3);
  ctx.stroke();
}

function finger(
  ctx: CanvasRenderingContext2D,
  points: [number, number, number, number, number, number],
  width = 20
) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  ctx.quadraticCurveTo(points[2], points[3], points[4], points[5]);
  ctx.lineWidth = width;
  ctx.strokeStyle = CAST.bartlebooth.head.skin;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
}

function crease(
  ctx: CanvasRenderingContext2D,
  points: [number, number, number, number, number, number],
  width = 1.5
) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  ctx.quadraticCurveTo(points[2], points[3], points[4], points[5]);
  ctx.lineWidth = width;
  ctx.strokeStyle = shade(CAST.bartlebooth.head.skin, -0.28);
  ctx.stroke();
}

function wPiece(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, faint = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.globalAlpha = faint ? 0.55 : 1;
  ctx.beginPath();
  ctx.moveTo(-25, -15);
  ctx.lineTo(-13, 15);
  ctx.lineTo(0, -5);
  ctx.lineTo(13, 15);
  ctx.lineTo(25, -15);
  ctx.lineWidth = 12;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
  ctx.lineWidth = 7;
  ctx.strokeStyle = PALETTE.sea;
  ctx.stroke();
  ctx.restore();
}

function closedHand(ctx: CanvasRenderingContext2D) {
  const skin = CAST.bartlebooth.head.skin;
  const shadeSkin = shade(skin, -0.12);
  wPiece(ctx, 211, 91, 0.34, true);
  shape(ctx, skin, () => {
    ctx.moveTo(89, 82);
    ctx.quadraticCurveTo(107, 72, 126, 61);
    ctx.quadraticCurveTo(151, 52, 184, 59);
    ctx.quadraticCurveTo(216, 63, 222, 83);
    ctx.lineTo(218, 105);
    ctx.quadraticCurveTo(213, 123, 194, 121);
    ctx.lineTo(143, 115);
    ctx.quadraticCurveTo(116, 123, 98, 108);
    ctx.closePath();
  });
  shape(ctx, shadeSkin, () => {
    ctx.moveTo(107, 80);
    ctx.quadraticCurveTo(116, 70, 128, 74);
    ctx.lineTo(157, 93);
    ctx.quadraticCurveTo(166, 100, 159, 111);
    ctx.quadraticCurveTo(151, 120, 140, 113);
    ctx.lineTo(111, 101);
    ctx.closePath();
  }, 5);
  for (const [x, y] of [[145, 77], [166, 75], [187, 78], [205, 84]] as const) {
    drawKnuckle(ctx, x, y, 15);
    crease(ctx, [x - 4, y + 9, x, y + 13, x + 5, y + 9], 1.8);
  }
  crease(ctx, [120, 103, 132, 101, 141, 108], 2.6);
  crease(ctx, [164, 107, 178, 111, 190, 108], 2.2);
}

function halfHand(ctx: CanvasRenderingContext2D) {
  const skin = CAST.bartlebooth.head.skin;
  const shadeSkin = shade(skin, -0.12);
  shape(ctx, skin, () => {
    ctx.moveTo(91, 82);
    ctx.quadraticCurveTo(112, 71, 133, 70);
    ctx.lineTo(193, 76);
    ctx.quadraticCurveTo(216, 81, 218, 101);
    ctx.lineTo(206, 119);
    ctx.quadraticCurveTo(190, 129, 173, 117);
    ctx.lineTo(141, 111);
    ctx.quadraticCurveTo(116, 120, 99, 106);
    ctx.closePath();
  });
  wPiece(ctx, 211, 96, 0.46, true);
  finger(ctx, [132, 75, 127, 48, 132, 24], 18);
  finger(ctx, [155, 76, 151, 42, 160, 17], 18);
  finger(ctx, [178, 84, 204, 77, 211, 91], 16);
  finger(ctx, [187, 99, 211, 93, 219, 106], 15);
  shape(ctx, shadeSkin, () => {
    ctx.moveTo(108, 83);
    ctx.quadraticCurveTo(119, 76, 130, 83);
    ctx.lineTo(151, 99);
    ctx.quadraticCurveTo(158, 106, 150, 114);
    ctx.quadraticCurveTo(142, 118, 133, 110);
    ctx.lineTo(111, 101);
    ctx.closePath();
  }, 5);
  drawKnuckle(ctx, 136, 73, 13);
  drawKnuckle(ctx, 158, 75, 13);
  crease(ctx, [169, 92, 181, 96, 192, 93], 2);
  crease(ctx, [174, 106, 186, 110, 196, 106], 2);
  crease(ctx, [119, 103, 132, 100, 140, 108], 2.4);
}

function openHand(ctx: CanvasRenderingContext2D) {
  const skin = CAST.bartlebooth.head.skin;
  shape(ctx, skin, () => {
    ctx.moveTo(100, 83);
    ctx.quadraticCurveTo(113, 69, 137, 70);
    ctx.lineTo(194, 83);
    ctx.quadraticCurveTo(218, 91, 214, 111);
    ctx.lineTo(195, 129);
    ctx.quadraticCurveTo(176, 137, 153, 124);
    ctx.lineTo(122, 114);
    ctx.quadraticCurveTo(101, 116, 92, 101);
    ctx.closePath();
  });
  const fingers: Array<[number, number, number, number]> = [
    [122, 77, 20, -18],
    [145, 74, 13, -7],
    [168, 79, 7, 7],
    [190, 86, -1, 20],
  ];
  for (const [x, y, angle, tip] of fingers) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((angle * Math.PI) / 180);
    finger(ctx, [0, 19, -5, 1, tip, -31], 17);
    drawKnuckle(ctx, -1, -1, 9);
    crease(ctx, [-6, 6, 0, 9, 6, 6], 1.8);
    ctx.restore();
  }
  shape(ctx, skin, () => {
    ctx.moveTo(112, 89);
    ctx.quadraticCurveTo(99, 78, 88, 79);
    ctx.quadraticCurveTo(79, 81, 78, 89);
    ctx.quadraticCurveTo(80, 99, 92, 104);
    ctx.lineTo(117, 110);
    ctx.quadraticCurveTo(128, 109, 130, 101);
    ctx.lineTo(119, 94);
    ctx.closePath();
  });
  crease(ctx, [101, 92, 108, 96, 113, 103], 1.8);
  crease(ctx, [138, 105, 151, 111, 162, 118], 2.2);
  crease(ctx, [174, 109, 184, 112, 191, 109], 2);
  wPiece(ctx, 178, 106, 0.8);
}

export function drawBartleboothHand(
  ctx: CanvasRenderingContext2D,
  pose: BartleboothHandPose
) {
  sleeve(ctx);
  if (pose === 'closed') closedHand(ctx);
  if (pose === 'half') halfHand(ctx);
  if (pose === 'open') openHand(ctx);
}
