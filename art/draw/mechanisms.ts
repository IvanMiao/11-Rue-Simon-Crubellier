import { CAST } from '../cast';
import { PALETTE, TONES } from '../palette';
import { shade } from './people';

export type BartleboothHandPose = 'closed' | 'half' | 'open';

function shape(ctx: CanvasRenderingContext2D, fill: string, draw: () => void, width = 6) {
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
  shape(ctx, CAST.bartlebooth.coat, () => {
    ctx.moveTo(4, 78);
    ctx.lineTo(83, 42);
    ctx.lineTo(125, 114);
    ctx.lineTo(29, 157);
    ctx.closePath();
  });
  ctx.beginPath();
  ctx.moveTo(71, 50);
  ctx.lineTo(104, 112);
  ctx.lineWidth = 14;
  ctx.strokeStyle = PALETTE.linen;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(71, 50);
  ctx.lineTo(104, 112);
  ctx.lineWidth = 5;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
}

function closedHand(ctx: CanvasRenderingContext2D) {
  const skin = CAST.bartlebooth.head.skin;
  const shadeSkin = shade(skin, -0.14);
  shape(ctx, skin, () => {
    ctx.moveTo(96, 66);
    ctx.quadraticCurveTo(119, 42, 151, 46);
    ctx.lineTo(212, 53);
    ctx.quadraticCurveTo(237, 59, 232, 83);
    ctx.lineTo(222, 106);
    ctx.quadraticCurveTo(211, 122, 191, 116);
    ctx.lineTo(143, 105);
    ctx.quadraticCurveTo(122, 114, 102, 104);
    ctx.closePath();
  });
  for (let i = 0; i < 4; i += 1) {
    const x = 139 + i * 22;
    shape(ctx, i % 2 ? shadeSkin : skin, () => {
      ctx.moveTo(x - 4, 55 + i * 2);
      ctx.quadraticCurveTo(x + 10, 44 + i * 3, x + 20, 58 + i * 3);
      ctx.lineTo(x + 18, 82 + i * 2);
      ctx.quadraticCurveTo(x + 10, 91 + i * 2, x + 1, 82 + i * 2);
      ctx.closePath();
    }, 4);
    ctx.beginPath();
    ctx.moveTo(x + 1, 72 + i * 2);
    ctx.quadraticCurveTo(x + 9, 66 + i * 2, x + 17, 72 + i * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = shade(skin, -0.28);
    ctx.stroke();
  }
  shape(ctx, shadeSkin, () => {
    ctx.moveTo(119, 80);
    ctx.quadraticCurveTo(102, 87, 111, 105);
    ctx.quadraticCurveTo(123, 121, 143, 107);
    ctx.lineTo(158, 93);
    ctx.quadraticCurveTo(146, 75, 133, 77);
    ctx.closePath();
  }, 5);
  ctx.beginPath();
  ctx.moveTo(117, 89);
  ctx.quadraticCurveTo(132, 90, 143, 101);
  ctx.lineWidth = 4;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
}

function halfHand(ctx: CanvasRenderingContext2D) {
  const skin = CAST.bartlebooth.head.skin;
  shape(ctx, skin, () => {
    ctx.moveTo(94, 68);
    ctx.quadraticCurveTo(117, 49, 145, 53);
    ctx.lineTo(191, 66);
    ctx.quadraticCurveTo(209, 76, 202, 96);
    ctx.lineTo(191, 113);
    ctx.quadraticCurveTo(177, 121, 158, 110);
    ctx.lineTo(125, 104);
    ctx.quadraticCurveTo(103, 113, 91, 99);
    ctx.closePath();
  });
  for (const [x, bend] of [[139, 14], [163, 7], [186, 2]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, 62);
    ctx.quadraticCurveTo(x + bend, 46, x + 21, 57);
    ctx.lineTo(x + 21, 91);
    ctx.quadraticCurveTo(x + 11, 100, x + 2, 89);
    ctx.lineWidth = 20;
    ctx.strokeStyle = skin;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = PALETTE.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 7, 78);
    ctx.quadraticCurveTo(x + 13, 73, x + 19, 79);
    ctx.lineWidth = 3;
    ctx.strokeStyle = shade(skin, -0.28);
    ctx.stroke();
  }
  shape(ctx, shade(skin, -0.12), () => {
    ctx.moveTo(115, 81);
    ctx.quadraticCurveTo(128, 66, 143, 76);
    ctx.lineTo(156, 97);
    ctx.quadraticCurveTo(146, 115, 128, 105);
    ctx.closePath();
  }, 5);
  ctx.beginPath();
  ctx.moveTo(116, 91);
  ctx.quadraticCurveTo(131, 88, 143, 103);
  ctx.lineWidth = 4;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
}

function openHand(ctx: CanvasRenderingContext2D) {
  const skin = CAST.bartlebooth.head.skin;
  const shadeSkin = shade(skin, -0.13);
  shape(ctx, skin, () => {
    ctx.moveTo(95, 72);
    ctx.quadraticCurveTo(112, 58, 142, 68);
    ctx.lineTo(196, 78);
    ctx.quadraticCurveTo(214, 84, 209, 102);
    ctx.lineTo(196, 120);
    ctx.quadraticCurveTo(178, 129, 156, 117);
    ctx.lineTo(123, 110);
    ctx.quadraticCurveTo(101, 115, 91, 99);
    ctx.closePath();
  });
  const fingers: Array<[number, number, number]> = [
    [128, 70, -29],
    [151, 70, -12],
    [174, 76, 8],
    [196, 83, 27],
  ];
  for (const [x, y, angle] of fingers) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(0, 17);
    ctx.quadraticCurveTo(-3, -10, 6, -34);
    ctx.lineWidth = 21;
    ctx.strokeStyle = skin;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = PALETTE.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-3, -5);
    ctx.lineTo(8, -3);
    ctx.lineWidth = 3;
    ctx.strokeStyle = shadeSkin;
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(112, 88);
  ctx.quadraticCurveTo(87, 82, 82, 98);
  ctx.quadraticCurveTo(84, 115, 104, 110);
  ctx.lineTo(127, 98);
  ctx.lineWidth = 22;
  ctx.strokeStyle = skin;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
  shape(ctx, PALETTE.paper, () => {
    ctx.moveTo(145, 97);
    ctx.lineTo(158, 78);
    ctx.lineTo(169, 96);
    ctx.lineTo(180, 78);
    ctx.lineTo(192, 98);
    ctx.lineTo(184, 118);
    ctx.lineTo(158, 118);
    ctx.closePath();
  }, 4);
  ctx.beginPath();
  ctx.moveTo(154, 98);
  ctx.lineTo(163, 86);
  ctx.lineTo(170, 100);
  ctx.lineTo(180, 86);
  ctx.lineWidth = 3;
  ctx.strokeStyle = PALETTE.sea;
  ctx.stroke();
}

export function drawBartleboothHand(
  ctx: CanvasRenderingContext2D,
  pose: BartleboothHandPose
) {
  ctx.save();
  ctx.shadowColor = 'rgba(28, 26, 25, 0.2)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 5;
  sleeve(ctx);
  if (pose === 'closed') closedHand(ctx);
  if (pose === 'half') halfHand(ctx);
  if (pose === 'open') openHand(ctx);
  ctx.restore();
}
