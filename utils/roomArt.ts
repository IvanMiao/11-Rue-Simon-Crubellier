import { RoomData } from '../types';
import { hashString } from './rng';

export type WindowVariant = 'pane2' | 'pane4' | 'wide' | 'shop' | 'attic' | 'cellar';
export type SilhouetteKind = 'empty' | 'sit' | 'stand' | 'pair' | 'lamp';
export type StillKind =
  | 'stamp'
  | 'teacup'
  | 'chess'
  | 'letter'
  | 'glasses'
  | 'clock'
  | 'cloth'
  | 'newspaper'
  | 'buttons'
  | 'keys'
  | 'puzzle'
  | 'book'
  | 'object';

const LAMPS = [
  '#e8b14a',
  '#d9a066',
  '#c9d6c4',
  '#e8c4b8',
  '#8eb4c4',
  '#d4783a',
  '#a3b37a',
  '#c9a06a',
  '#f0d78c',
  '#b7a08c',
];

export interface RoomLook {
  lamp: string;
  paint: string;
  window: WindowVariant;
  silhouette: SilhouetteKind;
  occupied: boolean;
}

export function floorLabel(floor: number): string {
  if (floor === 100) return 'C';
  if (floor === 0) return 'RC';
  if (floor === -1) return 'SS';
  if (floor === 1) return '1er';
  return `${floor}e`;
}

export function floorPaint(floor: number): string {
  if (floor === 100) return '#d7c7a4';
  if (floor >= 8) return '#efe4c6';
  if (floor >= 6) return '#ead9bc';
  if (floor >= 4) return '#e4d2b4';
  if (floor >= 2) return '#dcc9aa';
  if (floor === 0) return '#d4c4a4';
  return '#b9a888';
}

export function roomLook(room: RoomData): RoomLook {
  const h = hashString(room.id + (room.name || 'empty'));
  const occupied = Boolean(room.name && room.name.trim()) && room.type !== 'elevator';
  let window: WindowVariant = (['pane2', 'pane4', 'wide'] as WindowVariant[])[h % 3];
  if (room.floor >= 8) window = 'attic';
  if (room.floor === -1) window = 'cellar';
  if (room.floor === 0 && room.type !== 'stairwell') window = h % 2 ? 'shop' : 'pane2';
  if (room.type === 'elevator') window = 'wide';

  const silhouettes: SilhouetteKind[] = occupied
    ? ['sit', 'stand', 'pair', 'lamp', 'empty']
    : ['empty', 'empty', 'lamp'];
  const silhouette = silhouettes[h % silhouettes.length];

  let lamp = LAMPS[h % LAMPS.length];
  if (room.floor === -1) lamp = '#c45a32';
  if (room.type === 'elevator') lamp = '#c4b07a';
  if (room.type === 'service') lamp = '#9ab4b8';
  if (!occupied) lamp = '#6e6558';

  return {
    lamp,
    paint: floorPaint(room.floor),
    window,
    silhouette,
    occupied,
  };
}

export function stillLifeKind(name: string): StillKind {
  const n = name.toLowerCase();
  if (/邮票|stamp/.test(n)) return 'stamp';
  if (/茶|杯|cup|tea/.test(n)) return 'teacup';
  if (/棋|chess/.test(n)) return 'chess';
  if (/信|letter|信封/.test(n)) return 'letter';
  if (/眼镜|glasses/.test(n)) return 'glasses';
  if (/钟|clock|表/.test(n)) return 'clock';
  if (/手帕|帕|cloth|绣/.test(n)) return 'cloth';
  if (/报纸|news|报/.test(n)) return 'newspaper';
  if (/纽扣|button/.test(n)) return 'buttons';
  if (/钥匙|key/.test(n)) return 'keys';
  if (/拼图|puzzle/.test(n)) return 'puzzle';
  if (/簿|书|book|电话/.test(n)) return 'book';
  return 'object';
}
