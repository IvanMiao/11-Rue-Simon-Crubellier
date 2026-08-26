import { BUILDING_LAYOUT } from '../constants';
import { RoomData } from '../types';
import { getRoomCells } from './gridLogic';

export const CELL_W = 1.14;
export const CELL_H = 1.0;
export const CELL_D = 1.55;
export const COLS = 10;
export const ROWS = 10;

export interface RoomBox {
  id: string;
  room: RoomData;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
}

export function layoutRoom(room: RoomData): RoomBox | null {
  if (room.floor === 100) {
    return {
      id: room.id,
      room,
      x: 0,
      y: ROWS * CELL_H + 0.55,
      z: -CELL_D / 2,
      w: COLS * CELL_W * 0.72,
      h: 0.62,
      d: CELL_D,
    };
  }

  const cells = getRoomCells(room.id);
  if (!cells.length) return null;
  const minCol = Math.min(...cells.map((c) => c.col));
  const maxCol = Math.max(...cells.map((c) => c.col));
  const minRow = Math.min(...cells.map((c) => c.row));
  const maxRow = Math.max(...cells.map((c) => c.row));
  const w = (maxCol - minCol + 1) * CELL_W;
  const h = (maxRow - minRow + 1) * CELL_H;
  const x = ((minCol + maxCol + 1) / 2 - COLS / 2) * CELL_W;
  const y = (ROWS - 1 - maxRow) * CELL_H + h / 2;
  return { id: room.id, room, x, y, z: -CELL_D / 2, w, h, d: CELL_D };
}

export function layoutRooms(includeHundredth: boolean): RoomBox[] {
  return BUILDING_LAYOUT.map((room) => {
    if (room.floor === 100 && !includeHundredth) return null;
    return layoutRoom(room);
  }).filter((box): box is RoomBox => Boolean(box));
}

export function buildingCenterY(): number {
  return (ROWS * CELL_H) / 2;
}
