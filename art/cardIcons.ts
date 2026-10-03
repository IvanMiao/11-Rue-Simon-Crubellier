import { drawCardArt } from './draw/cardArt';

const icons = new Map<string, string>();

export function cardIconUrl(cardId: string, px = 64): string {
  const key = `${cardId}\u0000${px}`;
  const cached = icons.get(key);
  if (cached) return cached;

  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(px * ratio);
  canvas.height = Math.round(px * ratio);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create a card-icon canvas context.');

  context.scale(ratio, ratio);
  drawCardArt(context, cardId, px);
  const url = canvas.toDataURL('image/png');
  icons.set(key, url);
  return url;
}
