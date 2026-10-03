import { PALETTE } from '../palette';

export function withPaperBorder(src: HTMLCanvasElement, px: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create a paper-border canvas context.');

  for (let i = 0; i < 24; i += 1) {
    const angle = (i / 24) * Math.PI * 2;
    context.drawImage(src, Math.cos(angle) * px, Math.sin(angle) * px);
  }
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = PALETTE.linen;
  context.fillRect(0, 0, src.width, src.height);
  context.globalCompositeOperation = 'source-over';
  context.drawImage(src, 0, 0);
  return canvas;
}
