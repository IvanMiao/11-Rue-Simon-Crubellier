// Single entry point for illustrating a case card: bust, testimony balloon or glyph.
import { CAST, cardArt } from '../cast';
import { PALETTE } from '../palette';
import { drawGlyph } from './glyphs';
import { drawBust, shade } from './people';

export function drawCardArt(ctx: CanvasRenderingContext2D, cardId: string, size: number) {
  const art = cardArt(cardId);
  if (art.kind === 'bust') {
    drawBust(ctx, CAST[art.cast], size);
  } else if (art.kind === 'testimony') {
    const m = CAST[art.cast];
    const s = size / 100;
    // speech balloon tinted with the speaker's colour, the speaker's bust inside
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 4 * s;
    ctx.fillStyle = shade(m.color, 0.6);
    ctx.beginPath();
    ctx.ellipse(54 * s, 44 * s, 42 * s, 36 * s, 0, 0, Math.PI * 2);
    ctx.moveTo(26 * s, 72 * s);
    ctx.lineTo(10 * s, 94 * s);
    ctx.lineTo(42 * s, 78 * s);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(54 * s, 44 * s, 38 * s, 32 * s, 0, 0, Math.PI * 2);
    ctx.clip();
    drawBust(ctx, m, 76 * s);
    ctx.restore();
  } else {
    drawGlyph(ctx, art.glyph, size);
  }
}
