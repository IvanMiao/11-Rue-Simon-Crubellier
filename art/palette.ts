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
  washNavy: '#7893b5',
  sea: '#2e6fa3',
  accent: '#c8372d',
  linen: '#f7f1e3',
  green: '#4e8f5a',
  castWallSand: '#d9c79c',
  castFloorOchre: '#9b6a3c',
  castWallMint: '#dfe3d6',
  castFloorTaupe: '#8f7a5e',
  castWallStone: '#d8d2bd',
  castFloorRust: '#a7643c',
  castWallSage: '#cfd8bf',
  castFloorChestnut: '#8f5b3a',
  castWallCream: '#e6dcc3',
  castFloorHoney: '#b88a5a',
  castWallRose: '#f0d0bd',
  castFloorMahogany: '#7f4a3a',
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

/** Valène's canvas: charcoal grid on primed linen. */
export const CHARCOAL = {
  line: '#2a2724',
  faint: '#8c847a',
  number: '#6f675d',
  primed: '#f1eadb',
  wall: '#1c1a19',
};

/** Watercolour wash used when a cell has been entered, keyed by apartment id. */
export const WASH: Record<string, string> = {
  '3-1': PALETTE.washNavy,
  '6-3': TONES.ochre,
  '8-6': TONES.steel,
  '0-4': TONES.cobalt,
  '8-2': TONES.bottle,
  '7-7': TONES.aubergine,
  '6-1': TONES.rose,
  '0-5': PALETTE.wallMotif,
  STAIRS: PALETTE.wood,
  '0-3': TONES.leather,
  '-1-3': TONES.coal,
  '-1-5': TONES.slate,
};

/** Fallback washes for every other apartment, picked by a stable hash. */
export const WASH_FALLBACK = [
  PALETTE.floor,
  PALETTE.green,
  PALETTE.sea,
  TONES.sepia,
  TONES.hairAuburn,
  TONES.pine,
  TONES.plum,
  PALETTE.roof,
];

/**
 * Canvas relight per hour. The clock never stops, but the painting only changes its light
 * on the hour: 20:00 low gold from the rear facade, then amber, rose, and finally night.
 */
export const HOUR_LIGHT: Record<20 | 21 | 22 | 23, { tint: string; shade: string; angle: number; strength: number; night: number }> = {
  20: { tint: '#ffd9a3', shade: '#7a4c2a', angle: 112, strength: 0.32, night: 0 },
  21: { tint: '#f6b26b', shade: '#6b3d2a', angle: 100, strength: 0.36, night: 0.08 },
  22: { tint: '#e8875a', shade: '#3d2b4a', angle: 84, strength: 0.4, night: 0.22 },
  23: { tint: '#9fb4d9', shade: '#1b2440', angle: 70, strength: 0.42, night: 0.42 },
};

export const BLUEPRINT = {
  ground: '#263b4a',
  line: '#e1e4dc',
  fill: '#728792',
};
