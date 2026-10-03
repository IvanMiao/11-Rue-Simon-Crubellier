// Visual constitution for the paper-theatre renderer. Every colour, line weight and
// light value used by art/ code must come from here so the style cannot drift.

export const PALETTE = {
  ink: '#1c1a19',
  paper: '#f3ede0',
  paperDeep: '#e4d9c2',
  plaster: '#efe4c8',
  wall: '#ebd8a8',
  wallMotif: '#c79a5b',
  floor: '#c4613a',
  floorDark: '#a54e2e',
  wood: '#8a5a33',
  woodDark: '#5e3b22',
  brass: '#c99a3b',
  light: '#f7d774',
  sky: '#8ec1e3',
  skyWarm: '#f6c88a',
  roof: '#5d6f86',
  sea: '#2e6fa3',
  accent: '#c8372d',
  linen: '#f7f1e3',
  green: '#4e8f5a',
} as const;

export interface Resident {
  id: string;
  name: string;
  coat: string;
  trousers: string;
  hair: string;
  skin: string;
  wall: string;
  floor: string;
}

// One signature colour per resident; it is the coat, the window glow and the clue-card tint.
export const RESIDENTS: Record<string, Resident> = {
  bartlebooth: { id: 'bartlebooth', name: '巴特尔布思', coat: '#24356b', trousers: '#3b3a45', hair: '#e8e4da', skin: '#f2c49b', wall: PALETTE.wall, floor: PALETTE.floor },
  winckler: { id: 'winckler', name: '温克勒', coat: '#b5762a', trousers: '#4a3d33', hair: '#9a9a9a', skin: '#eab48c', wall: '#d9c79c', floor: '#9b6a3c' },
  valene: { id: 'valene', name: '瓦莱纳', coat: '#7a4c7a', trousers: '#2f2f3a', hair: '#f0f0f0', skin: '#efbf97', wall: '#e6dcc3', floor: '#b88a5a' },
  smautf: { id: 'smautf', name: '斯莫特', coat: '#4e8f5a', trousers: '#2b3a2f', hair: '#3b2a20', skin: '#d9a47c', wall: '#cfd8bf', floor: '#8f5b3a' },
  marquiseau: { id: 'marquiseau', name: '马基索夫人', coat: '#b4505c', trousers: '#3d2b30', hair: '#7a3b20', skin: '#f3c7a2', wall: '#f0d0bd', floor: '#7f4a3a' },
  concierge: { id: 'concierge', name: '诺谢尔太太', coat: '#2e6fa3', trousers: '#26303b', hair: '#5b4636', skin: '#e9b58f', wall: '#d8d2bd', floor: '#a7643c' },
};

export const LINE = {
  /** Ink outline width in CSS pixels. */
  widthPx: 1.55,
  /** Depth discontinuity (world units) that becomes an ink line. */
  depthThreshold: 0.12,
  /** 1 - dot(n1, n2) above this becomes an ink line. */
  normalThreshold: 0.28,
  /** Ink colour of the paper border around cut-out figures. */
  cutoutBorderPx: 9,
};

/** Cel bands for MeshToonMaterial: shadow, half-tone, lit. */
export const TOON_STEPS = [0.5, 0.78, 1.0];

/** 23 June 1975, 20:00, Paris (no DST that year): low golden sun from the rear facade. */
export const LIGHT_2000 = {
  sunColor: '#ffd9a3',
  sunIntensity: 2.6,
  sunDir: [0.42, -0.5, 0.76] as [number, number, number],
  fillColor: '#c9d6ff',
  fillIntensity: 0.55,
  hemiSky: '#e9e3d4',
  hemiGround: '#9a7a62',
  hemiIntensity: 1.15,
  beamOpacity: 0.09,
};

export const PRINT = {
  grain: 0.1,
  fibre: 0.05,
  vignette: 0.22,
  /** Strength of the 45° halftone screen printed into the darkest tones. */
  halftone: 0.16,
  /** Halftone cell size in CSS pixels. */
  halftoneCell: 4.5,
};

export const TYPE = {
  display: "'Noto Serif SC', 'Noto Serif CJK SC', 'Lora', serif",
  body: "'Noto Serif SC', 'Noto Serif CJK SC', 'Lora', serif",
  mono: "'Courier Prime', 'DejaVu Sans Mono', monospace",
};
