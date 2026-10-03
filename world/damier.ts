import { BUILDING_LAYOUT } from '../constants';

export interface Cell {
  id: string;
  floor: number;
  col: number;
  chapter: number | null;
  apartmentId: string;
  index: number;
}

export const CHAPTER_GRID: number[][] = [
  [59, 83, 15, 10, 57, 48, 7, 52, 45, 54],
  [97, 11, 58, 82, 16, 9, 46, 55, 6, 51],
  [84, 60, 96, 14, 47, 56, 49, 8, 53, 44],
  [12, 98, 81, 86, 95, 17, 28, 43, 50, 5],
  [61, 85, 13, 18, 27, 79, 94, 4, 41, 30],
  [99, 70, 26, 80, 87, 1, 42, 29, 93, 3],
  [25, 62, 88, 69, 19, 36, 78, 2, 31, 40],
  [71, 65, 20, 23, 89, 68, 34, 37, 77, 92],
  [63, 24, 66, 73, 35, 22, 90, 75, 39, 32],
  [0, 72, 64, 21, 67, 74, 38, 33, 91, 76],
];

export const CHAPTER_ONE_CELL = '3:6';
export const CLINAMEN_CELL = '-1:1';

export const APARTMENT_TITLES: Record<string, string> = {
  '3-1': '巴特尔布思',
  '6-3': '温克勒',
  '8-6': '莫雷莱',
  '0-4': '门房',
  '8-2': '斯莫特',
  '7-7': '瓦莱纳',
  '6-1': '辛诺克',
  '0-5': '门厅',
  STAIRS: '楼梯间',
  '0-3': '古董店',
  '-1-3': '锅炉房',
  '-1-5': '电梯机房',
  '0-1': '仆人入口',
  '-1-1': '缺掉的一格',
};

const floors = [8, 7, 6, 5, 4, 3, 2, 1, 0, -1];

function apartmentByCell(): Record<string, string> {
  const apartments: Record<string, string> = {};
  const roomStartColumns: Record<string, number> = {};
  for (const floor of floors) {
    const rooms = BUILDING_LAYOUT.filter((room) => room.floor === floor);
    let col = 1;
    for (const room of rooms) {
      if (floor >= 1 && floor <= 5 && col === 6) col += 2;
      roomStartColumns[room.id] = col;
      for (let offset = 0; offset < (room.colSpan || 1); offset += 1) {
        apartments[`${floor}:${col + offset}`] = room.id;
      }
      col += room.colSpan || 1;
    }
  }
  for (const room of BUILDING_LAYOUT) {
    if (!room.rowSpan || room.rowSpan < 2) continue;
    for (let offset = 1; offset < room.rowSpan; offset += 1) {
      const floor = room.floor - offset;
      const start = roomStartColumns[room.id] || 1;
      for (let col = start; col < start + (room.colSpan || 1); col += 1) {
        apartments[`${floor}:${col}`] = room.id;
      }
    }
  }
  return apartments;
}

const apartmentIds = apartmentByCell();

const baseCells = CHAPTER_GRID.flatMap((row, rowIndex) =>
  row.map((chapter, colIndex) => {
    const floor = 8 - rowIndex;
    const col = colIndex + 1;
    const id = `${floor}:${col}`;
    return {
      id,
      floor,
      col,
      chapter: chapter || null,
      apartmentId: apartmentIds[id],
      index: 1,
    };
  })
);

const cellRanks = new Map<string, number>();
baseCells
  .filter((cell) => cell.chapter !== null)
  .sort((a, b) => a.apartmentId.localeCompare(b.apartmentId) || a.chapter! - b.chapter!)
  .forEach((cell) => {
    const index = (cellRanks.get(cell.apartmentId) || 0) + 1;
    cellRanks.set(cell.apartmentId, index);
    cell.index = index;
  });

export const CELLS: Cell[] = baseCells;
export const CELL_BY_ID: Record<string, Cell> = Object.fromEntries(
  CELLS.map((cell) => [cell.id, cell])
);

export function cellAt(floor: number, col: number): Cell | undefined {
  return CELL_BY_ID[`${floor}:${col}`];
}

export function cellTitle(cellId: string): string {
  const cell = CELL_BY_ID[cellId];
  if (!cell) return cellId;
  const title =
    APARTMENT_TITLES[cell.apartmentId] ||
    BUILDING_LAYOUT.find((room) => room.id === cell.apartmentId)?.name ||
    cell.apartmentId;
  return `${title}, ${cell.index}`;
}

const ROMAN_VALUES: Array<[number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function chapterNumeral(n: number): string {
  if (!Number.isInteger(n) || n <= 0) return '';
  let remaining = n;
  let result = '';
  ROMAN_VALUES.forEach(([value, numeral]) => {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  });
  return result;
}
