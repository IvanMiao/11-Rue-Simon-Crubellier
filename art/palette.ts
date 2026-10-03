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

/** Tones for the A2 cast and card glyphs (skin, hair, cloth). Cast specs in art/cast.ts reference these. */
export const TONES = {
  skinPale: '#f2c49b',
  skinWarm: '#eab48c',
  skinRuddy: '#e9a982',
  skinOlive: '#d9a47c',
  hairWhite: '#ece8de',
  hairGrey: '#9a9a9a',
  hairAuburn: '#7a3b20',
  hairBrown: '#5b4636',
  navy: '#24356b',
  ochre: '#b5762a',
  aubergine: '#7a4c7a',
  bottle: '#4e8f5a',
  rose: '#b4505c',
  cobalt: '#2e6fa3',
  labWhite: '#eef0ea',
  charcoal: '#3b3a45',
  umber: '#4a3d33',
  leather: '#7b4a2a',
  apron: '#f4efe2',
  coal: '#2b2826',
  steel: '#8d97a3',
  bandage: '#f6f3ea',
  sepia: '#b89a6e',
  glass: '#bcd6dc',
  slate: '#26303b',
  pine: '#2b3a2f',
  graphite: '#2f2f3a',
  plum: '#3d2b30',
  scarf: '#c8372d',
} as const;

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
