import { PALETTE, TONES } from '../palette';

type DicePhase = 'hold' | 'shake' | 'open';

export function drawDiceHand(
  ctx: CanvasRenderingContext2D,
  { phase, tick, die1, die2 }: { phase: DicePhase; tick: number; die1: number; die2: number }
) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const scale = Math.min(width / 420, height / 150);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate((width - 420 * scale) / 2, (height - 150 * scale) / 2);
  ctx.scale(scale, scale);

  const pip = (x: number, y: number) => {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  };
  const die = (x: number, y: number, value: number, angle = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = PALETTE.paper;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-22, -22, 44, 44, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    const points: Record<number, [number, number][]> = {
      1: [[0, 0]],
      2: [[-10, -10], [10, 10]],
      3: [[-10, -10], [0, 0], [10, 10]],
      4: [[-10, -10], [10, -10], [-10, 10], [10, 10]],
      5: [[-10, -10], [10, -10], [0, 0], [-10, 10], [10, 10]],
      6: [[-10, -12], [10, -12], [-10, 0], [10, 0], [-10, 12], [10, 12]],
    };
    points[Math.max(1, Math.min(6, value))].forEach(([px, py]) => pip(px, py));
    ctx.restore();
  };

  const shakeX = phase === 'shake' ? Math.sin(tick * 1.8) * 12 : 0;
  const shakeY = phase === 'shake' ? Math.cos(tick * 1.45) * 7 : 0;
  const diceY = phase === 'open' ? 32 : 86 + shakeY;
  die(178 + shakeX, diceY, die1, phase === 'shake' ? Math.sin(tick) * 0.34 : -0.12);
  die(235 - shakeX, diceY - (phase === 'open' ? 4 : 0), die2, phase === 'shake' ? Math.cos(tick) * 0.28 : 0.12);

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = PALETTE.ink;
  ctx.fillStyle = TONES.skinWarm;
  if (phase === 'open') {
    ctx.beginPath();
    ctx.moveTo(114, 138);
    ctx.quadraticCurveTo(136, 88, 173, 84);
    ctx.quadraticCurveTo(202, 79, 236, 87);
    ctx.quadraticCurveTo(269, 83, 297, 96);
    ctx.lineTo(325, 124);
    ctx.quadraticCurveTo(316, 144, 294, 137);
    ctx.lineTo(266, 121);
    ctx.lineTo(180, 122);
    ctx.lineTo(146, 149);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (const x of [192, 220, 248, 275]) {
      ctx.beginPath();
      ctx.moveTo(x, 95);
      ctx.quadraticCurveTo(x + 8, 107, x + 2, 116);
      ctx.stroke();
    }
    ctx.fillStyle = TONES.skinWarm;
    ctx.beginPath();
    ctx.roundRect(35, 108, 112, 34, 14);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(92, 140);
    ctx.lineTo(143, 98);
    ctx.quadraticCurveTo(165, 77, 192, 91);
    ctx.lineTo(248, 103);
    ctx.quadraticCurveTo(281, 112, 306, 132);
    ctx.lineTo(285, 147);
    ctx.lineTo(214, 132);
    ctx.lineTo(168, 145);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (const x of [205, 229, 253, 275]) {
      ctx.beginPath();
      ctx.moveTo(x, 104);
      ctx.lineTo(x - 7, 124);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.roundRect(34, 118, 105, 29, 14);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
