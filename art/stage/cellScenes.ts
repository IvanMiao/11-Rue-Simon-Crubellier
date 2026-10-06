import { CAST, type CastId } from '../cast';
import { PALETTE, WASH, WASH_FALLBACK } from '../palette';
import { CELL_BY_ID, CLINAMEN_CELL } from '../../world/damier';

export type CellRoomKind =
  | 'stair'
  | 'hall'
  | 'loge'
  | 'atelier'
  | 'sill'
  | 'workshop'
  | 'servant'
  | 'studio'
  | 'lab'
  | 'boiler'
  | 'shop'
  | 'archive'
  | 'clinamen'
  | 'empty';

export interface CellScene {
  kind: CellRoomKind;
  resident?: CastId;
  wall: string;
  floor: string;
  seed: number;
}

export const CELL_ROOM = { W: 3.4, H: 3, D: 3.2 };

export const ANCHORS: Record<string, [number, number, number]> = {
  'ev-stair-notebook': [0.18, 0.5, 0.7],
  'ev-hall-mailboxes': [0, 1.28, -1.34],
  'ev-hall-lift': [0.86, 1.12, -1.22],
  'ev-bb-puzzle': [-0.1, 0.8, -0.1],
  'ev-bb-hand': [0.66, 0.95, 0.28],
  'ev-bb-hand-late': [0.66, 0.95, 0.28],
  'ev-bb-sill': [-0.22, 0.99, -1.25],
  'ev-wk-bench': [-0.38, 0.86, -0.98],
  'ev-wk-chair': [-0.52, 0.62, 0.64],
  'ev-loge-notice': [-0.92, 1.54, -1.42],
  'ev-loge-ask': [0.58, 1.08, -0.12],
  'ev-sm-ask': [1.04, 1.04, 0.18],
  'ev-va-ask': [0.98, 1.18, 0.36],
  'ev-va-canvas': [-0.72, 1.4, -1.38],
  'ev-mo-vat': [-0.2, 0.74, -0.18],
  'ev-ch-coal': [0.62, 0.3, 0.44],
  'ev-an-receipt': [-0.32, 0.98, -0.56],
  'ev-ci-dict': [1.05, 1.44, -0.99],
  'it-keyring': [-0.1, 1.04, 0.4],
  'it-loupe': [0.68, 0.84, -0.16],
  '100-1-finale': [0, 0.82, 0.25],
};

export const PLAYER_SPOT: Record<CellRoomKind, [x: number, y: number, z: number]> = {
  stair: [1.3, 0.015, 1.28],
  hall: [-1.28, 0.015, 1.2],
  loge: [1.25, 0.015, 1.2],
  atelier: [1.35, 0.015, 1.25],
  sill: [1.3, 0.015, 1.2],
  workshop: [1.32, 0.015, 1.2],
  servant: [-1.3, 0.015, 1.2],
  studio: [-1.3, 0.015, 1.2],
  lab: [-1.3, 0.015, 1.2],
  boiler: [1.3, 0.015, 1.2],
  shop: [1.3, 0.015, 1.2],
  archive: [-1.3, 0.015, 1.2],
  clinamen: [1.3, 0.015, 1.2],
  empty: [1.3, 0.015, 1.2],
};

export const PLAYER_SPOT_ANCHORS: Partial<Record<CellRoomKind, readonly string[]>> = {
  stair: ['ev-stair-notebook'],
  hall: ['ev-hall-mailboxes', 'ev-hall-lift'],
  loge: ['ev-loge-notice', 'ev-loge-ask'],
  atelier: ['ev-bb-puzzle', 'ev-bb-hand', 'ev-bb-hand-late'],
  sill: ['ev-bb-sill'],
  workshop: ['ev-wk-bench', 'ev-wk-chair'],
  servant: ['ev-sm-ask'],
  studio: ['ev-va-ask', 'ev-va-canvas'],
  lab: ['ev-mo-vat'],
  boiler: ['ev-ch-coal'],
  shop: ['ev-an-receipt'],
  archive: ['ev-ci-dict'],
  clinamen: ['100-1-finale'],
  empty: [],
};

function hash(value: string): number {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}

function scene(
  kind: CellRoomKind,
  cellId: string,
  apartmentId: string,
  resident?: CastId
): CellScene {
  const cell = CELL_BY_ID[cellId];
  const seed = cell?.index ?? hash(cellId);
  const member = resident ? CAST[resident] : undefined;
  const paletteIndex = hash(apartmentId);
  return {
    kind,
    ...(resident ? { resident } : {}),
    wall: member?.wall ?? WASH[apartmentId] ?? WASH_FALLBACK[paletteIndex % WASH_FALLBACK.length],
    floor: member?.floor ?? WASH_FALLBACK[(paletteIndex + 3) % WASH_FALLBACK.length],
    seed,
  };
}

export function cellScene(cellId: string): CellScene {
  const cell = CELL_BY_ID[cellId];
  const apartmentId = cell?.apartmentId ?? '';

  if (cellId === CLINAMEN_CELL) {
    return {
      kind: 'clinamen',
      wall: PALETTE.ink,
      floor: PALETTE.floorDark,
      seed: hash(cellId),
    };
  }
  if (apartmentId === 'STAIRS') {
    return { ...scene('stair', cellId, apartmentId), wall: PALETTE.plaster, floor: PALETTE.paperDeep };
  }
  if (cellId === '0:6' || cellId === '0:7' || apartmentId === '0-5') {
    return { ...scene('hall', cellId, apartmentId), wall: PALETTE.plaster, floor: PALETTE.paperDeep };
  }
  if (apartmentId === '0-4') return scene('loge', cellId, apartmentId, 'nochere');
  if (apartmentId === '3-1') {
    if (cellId === '3:1') return scene('atelier', cellId, apartmentId, 'bartlebooth');
    return {
      ...scene('sill', cellId, apartmentId),
      wall: PALETTE.castWallCream,
      floor: PALETTE.paperDeep,
    };
  }
  if (apartmentId === '6-3') return scene('workshop', cellId, apartmentId, 'winckler');
  if (apartmentId === '8-2') return scene('servant', cellId, apartmentId, 'smautf');
  if (apartmentId === '7-7') return scene('studio', cellId, apartmentId, 'valene');
  if (apartmentId === '8-6') return scene('lab', cellId, apartmentId, 'morellet');
  if (apartmentId === '-1-3') {
    return {
      ...scene('boiler', cellId, apartmentId),
      wall: PALETTE.castWallStone,
      floor: PALETTE.floorDark,
    };
  }
  if (apartmentId === '0-3') return scene('shop', cellId, apartmentId);
  if (apartmentId === '6-1') return scene('archive', cellId, apartmentId);
  return { ...scene('empty', cellId, apartmentId), wall: PALETTE.plaster, floor: PALETTE.paperDeep };
}

export function anchorFor(cellId: string, lineId: string, index: number): [number, number, number] {
  const anchor = ANCHORS[lineId];
  if (anchor) return [...anchor];
  const cell = CELL_BY_ID[cellId];
  const slot = ((Number.isFinite(index) ? Math.trunc(index) : 0) % 8 + 8) % 8;
  const row = Math.min(9, Math.max(0, Math.floor(index / 8)));
  return [-1.35 + slot * 0.38, 0.18 + row * 0.3, cell ? CELL_ROOM.D / 2 - 0.14 : 1.46];
}
