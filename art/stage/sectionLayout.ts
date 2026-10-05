import { CELL_ROOM } from './cellScenes';
import { CELL_BY_ID, CELLS, CLINAMEN_CELL } from '../../world/damier';

export type SectionView = 'room' | 'block' | 'building';
export type FlightKind = 'walk' | 'knight' | 'elevator';
export type DetailTier = 'room' | 'painted' | 'sketch' | 'void';

const FLOOR_MIN = -1;
const FLOOR_MAX = 8;
const COLUMN_MIN = 1;
const COLUMN_MAX = 10;
const PITCH_X = CELL_ROOM.W + 0.12;
const PITCH_Y = CELL_ROOM.H + 0.24;
const BUILDING_WIDTH = (COLUMN_MAX - COLUMN_MIN + 1) * PITCH_X;
const ROOM_YAW = (23 * Math.PI) / 180;
const ROOM_PITCH = (10 * Math.PI) / 180;

function coordinates(cellId: string): { floor: number; col: number } {
  const cell = CELL_BY_ID[cellId];
  if (!cell) throw new RangeError(`Unknown building cell: ${cellId}`);
  return { floor: cell.floor, col: cell.col };
}

export function cellOrigin3d(cellId: string): [x: number, y: number, z: number] {
  const { floor, col } = coordinates(cellId);
  return [(col - 5.5) * PITCH_X, floor * PITCH_Y, 0];
}

export function cellAtPoint(x: number, y: number): string | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const columnIndex = Math.floor((x + BUILDING_WIDTH / 2) / PITCH_X);
  const floor = Math.floor(y / PITCH_Y + 0.5);
  const col = COLUMN_MIN + columnIndex;
  if (col < COLUMN_MIN || col > COLUMN_MAX || floor < FLOOR_MIN || floor > FLOOR_MAX) {
    return null;
  }
  return `${floor}:${col}`;
}

export interface SectionFrame {
  target: [x: number, y: number, z: number];
  viewHeight: number;
  yaw: number;
  pitch: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function frameFor(view: SectionView, cellId: string, aspect: number): SectionFrame {
  const { floor, col } = coordinates(cellId);
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;

  if (view === 'room') {
    const [x, y, z] = cellOrigin3d(cellId);
    const viewportWidth = CELL_ROOM.W + SECTION_PITCH.x * 0.5;
    const isClinamen = cellId === CLINAMEN_CELL;
    return {
      target: [x, y + CELL_ROOM.H / 2 - (isClinamen ? 0.48 : 0), z],
      viewHeight: isClinamen ? 4.4 : Math.max(3.15, viewportWidth / safeAspect),
      yaw: ROOM_YAW,
      pitch: ROOM_PITCH,
    };
  }

  if (view === 'block') {
    const centerFloor = clamp(floor, FLOOR_MIN + 2, FLOOR_MAX - 2);
    const centerCol = clamp(col, COLUMN_MIN + 2, COLUMN_MAX - 2);
    const target: [number, number, number] = [
      (centerCol - 5.5) * PITCH_X,
      centerFloor * PITCH_Y + CELL_ROOM.H / 2,
      0,
    ];
    const visibleWidth = 5 * PITCH_X;
    const visibleHeight = 5 * PITCH_Y;
    return {
      target,
      viewHeight: Math.max(visibleHeight, visibleWidth / safeAspect) * 1.12,
      yaw: ROOM_YAW * 0.38,
      pitch: ROOM_PITCH * 0.42,
    };
  }

  const roofTop = FLOOR_MAX * PITCH_Y + CELL_ROOM.H + 3.35;
  const cellarBottom = FLOOR_MIN * PITCH_Y - 1.2;
  const viewHeight = Math.max(
    (roofTop - cellarBottom) * 1.1,
    (BUILDING_WIDTH / safeAspect) * 1.1
  );
  return {
    target: [0, (roofTop + cellarBottom) / 2, 0],
    viewHeight,
    yaw: 0,
    pitch: 0,
  };
}

export function flightPath(from: string, to: string, kind: FlightKind): string[] {
  if (kind !== 'knight') return [from, to];
  const start = coordinates(from);
  const end = coordinates(to);
  const floorDelta = end.floor - start.floor;
  const colDelta = end.col - start.col;
  const isKnightMove =
    (Math.abs(floorDelta) === 2 && Math.abs(colDelta) === 1) ||
    (Math.abs(floorDelta) === 1 && Math.abs(colDelta) === 2);
  if (!isKnightMove) return [from, to];
  const cornerFloor =
    Math.abs(floorDelta) === 2 ? start.floor + Math.sign(floorDelta) * 2 : start.floor;
  const cornerCol =
    Math.abs(colDelta) === 2 ? start.col + Math.sign(colDelta) * 2 : start.col;
  return [from, `${cornerFloor}:${cornerCol}`, to];
}

export function detailTier(
  cellId: string,
  focusCellId: string,
  visited: ReadonlySet<string>,
  view: SectionView = 'room'
): DetailTier {
  if (cellId === CLINAMEN_CELL) return 'void';
  if (view === 'building') {
    return cellId === focusCellId ? 'room' : visited.has(cellId) ? 'painted' : 'sketch';
  }
  const cell = coordinates(cellId);
  const focus = coordinates(focusCellId);
  if (Math.abs(cell.floor - focus.floor) <= 1 && Math.abs(cell.col - focus.col) <= 1) {
    return 'room';
  }
  return visited.has(cellId) ? 'painted' : 'sketch';
}

export const SECTION_CELL_IDS = CELLS.map(({ id }) => id);
export const SECTION_PITCH = { x: PITCH_X, y: PITCH_Y };
