import { CLINAMEN_CELL, CELLS, CELL_BY_ID, cellAt, CHAPTER_ONE_CELL } from '../world/damier';

export interface GridCell {
  row: number;
  col: number;
}

export const floorToRow = (floor: number): number => 8 - floor;

export const getRoomCells = (apartmentId: string): GridCell[] =>
  CELLS.filter((cell) => cell.apartmentId === apartmentId).map((cell) => ({
    row: floorToRow(cell.floor),
    col: cell.col - 1,
  }));

const adjacentCellIds = (cellId: string): string[] => {
  const cell = CELL_BY_ID[cellId];
  if (!cell) return [];
  return [
    cellAt(cell.floor - 1, cell.col)?.id,
    cellAt(cell.floor + 1, cell.col)?.id,
    cellAt(cell.floor, cell.col - 1)?.id,
    cellAt(cell.floor, cell.col + 1)?.id,
  ].filter((id): id is string => Boolean(id));
};

export const getAdjacentRooms = (cellId: string): string[] => adjacentCellIds(cellId);

export const getSameFloorNeighbors = (cellId: string): string[] => {
  const cell = CELL_BY_ID[cellId];
  if (!cell) return [];
  return [cellAt(cell.floor, cell.col - 1)?.id, cellAt(cell.floor, cell.col + 1)?.id].filter(
    (id): id is string => Boolean(id)
  );
};

export const getValidKnightMoves = (cellId: string): string[] => {
  const cell = CELL_BY_ID[cellId];
  if (!cell) return [];
  const offsets = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];
  return offsets
    .map(([floorOffset, colOffset]) => cellAt(cell.floor + floorOffset, cell.col + colOffset)?.id)
    .filter((id): id is string => Boolean(id) && id !== CLINAMEN_CELL);
};

export interface ReachableMap {
  walk: Set<string>;
  knight: Set<string>;
  elevator: Set<string>;
  all: Set<string>;
}

export const getReachableRooms = (
  currentRoomId: string | null,
  options?: { hundredthUnlocked?: boolean }
): ReachableMap => {
  const walk = new Set<string>();
  const knight = new Set<string>();
  const elevator = new Set<string>();

  if (!currentRoomId) {
    walk.add(CHAPTER_ONE_CELL);
    return { walk, knight, elevator, all: new Set(walk) };
  }

  const current = CELL_BY_ID[currentRoomId];
  if (!current) return { walk, knight, elevator, all: new Set() };

  adjacentCellIds(currentRoomId).forEach((id) => {
    if (id !== CLINAMEN_CELL || options?.hundredthUnlocked) walk.add(id);
  });
  getValidKnightMoves(currentRoomId).forEach((id) => knight.add(id));

  if (current.floor >= 0 && current.floor <= 6 && (current.col === 6 || current.col === 7)) {
    for (let floor = 0; floor <= 6; floor += 1) {
      const destination = cellAt(floor, current.col);
      if (destination && destination.id !== currentRoomId) elevator.add(destination.id);
    }
  }

  const all = new Set<string>([...walk, ...knight, ...elevator]);
  return { walk, knight, elevator, all };
};

export const describeMove = (
  reachable: ReachableMap,
  targetId: string
): 'walk' | 'knight' | 'elevator' | 'blocked' => {
  if (reachable.knight.has(targetId)) return 'knight';
  if (reachable.walk.has(targetId)) return 'walk';
  if (reachable.elevator.has(targetId)) return 'elevator';
  return 'blocked';
};

export const STAIR_COLS = [6, 7];
export const STAIR_FLOORS = [0, 1, 2, 3, 4, 5, 6];
