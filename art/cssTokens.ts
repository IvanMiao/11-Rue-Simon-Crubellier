import { CHARCOAL, PALETTE, TONES } from './palette';

/** Expose palette tokens as CSS custom properties so the world UI never hard-codes colours. */
export const CSS_TOKENS: Record<string, string> = {
  '--ink': PALETTE.ink,
  '--paper': PALETTE.paper,
  '--paper-deep': PALETTE.paperDeep,
  '--linen': PALETTE.linen,
  '--charcoal': CHARCOAL.line,
  '--charcoal-faint': CHARCOAL.faint,
  '--charcoal-number': CHARCOAL.number,
  '--brass': PALETTE.brass,
  '--accent': PALETTE.accent,
  '--light': PALETTE.light,
  '--desk': PALETTE.woodDark,
  '--pine': TONES.pine,
  '--graphite': TONES.graphite,
};

export function applyCssTokens(root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(CSS_TOKENS)) root.style.setProperty(name, value);
}
