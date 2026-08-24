import { BUILDING_LAYOUT } from '../constants';

export interface GridCell {
  row: number;
  col: number;
}

const GRID_SIZE = 10;
const ELEVATOR_COLS = [5, 6];
const ELEVATOR_FLOORS = [6, 5, 4, 3, 2, 1];

export const floorToRow = (floor: number): number => 8 - floor;

const buildRoomGridMap = (): Record<string, GridCell[]> => {
  const map: Record<string, GridCell[]> = {};
  const floors = [8, 7, 6, 5, 4, 3, 2, 1, 0, -1];

  floors.forEach((floor) => {
    const roomsOnFloor = BUILDING_LAYOUT.filter((r) => r.floor === floor);
    let currentCol = 0;
    const rowStart = floorToRow(floor);

    roomsOnFloor.forEach((room) => {
      if (floor >= 1 && floor <= 5 && currentCol === 5) {
        currentCol += 2;
      }

      const colSpan = room.colSpan || 1;
      const rowSpan = room.rowSpan || 1;
      const roomCells: GridCell[] = [];

      for (let r = 0; r < rowSpan; r++) {
        for (let c = 0; c < colSpan; c++) {
          roomCells.push({
            row: rowStart + r,
            col: currentCol + c,
          });
        }
      }

      map[room.id] = (map[room.id] || []).concat(roomCells);
      currentCol += colSpan;
    });
  });

  return map;
};

const roomGridMap = buildRoomGridMap();

const cellToRoom: string[][] = Array.from({ length: GRID_SIZE }, () =>
  Array(GRID_SIZE).fill('')
);

Object.entries(roomGridMap).forEach(([id, cells]) => {
  cells.forEach(({ row, col }) => {
    if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
      cellToRoom[row][col] = id;
    }
  });
});

export const getRoomCells = (roomId: string): GridCell[] => roomGridMap[roomId] || [];

const findRoomAt = (row: number, col: number): string | undefined => {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return undefined;
  return cellToRoom[row][col] || undefined;
};

export const getValidKnightMoves = (currentRoomId: string): string[] => {
  const currentCells = roomGridMap[currentRoomId];
  if (!currentCells) return [];

  const validTargetIds = new Set<string>();
  const moves = [
    { r: -2, c: -1 },
    { r: -2, c: 1 },
    { r: -1, c: -2 },
    { r: -1, c: 2 },
    { r: 1, c: -2 },
    { r: 1, c: 2 },
    { r: 2, c: -1 },
    { r: 2, c: 1 },
  ];

  currentCells.forEach((cell) => {
    moves.forEach((move) => {
      const targetRoomId = findRoomAt(cell.row + move.r, cell.col + move.c);
      if (targetRoomId && targetRoomId !== currentRoomId) {
        validTargetIds.add(targetRoomId);
      }
    });
  });

  return Array.from(validTargetIds);
};

export const getAdjacentRooms = (currentRoomId: string): string[] => {
  const currentCells = roomGridMap[currentRoomId];
  if (!currentCells) return [];

  const neighbors = new Set<string>();
  const edges = [
    { r: -1, c: 0 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 },
  ];

  currentCells.forEach((cell) => {
    edges.forEach((edge) => {
      const target = findRoomAt(cell.row + edge.r, cell.col + edge.c);
      if (target && target !== currentRoomId) neighbors.add(target);
    });
  });

  return Array.from(neighbors);
};

export const getSameFloorNeighbors = (currentRoomId: string): string[] => {
  const room = BUILDING_LAYOUT.find((r) => r.id === currentRoomId);
  if (!room) return [];
  const floorRooms = BUILDING_LAYOUT.filter((r) => r.floor === room.floor);
  const idx = floorRooms.findIndex((r) => r.id === currentRoomId);
  const ids: string[] = [];
  if (idx > 0) ids.push(floorRooms[idx - 1].id);
  if (idx < floorRooms.length - 1) ids.push(floorRooms[idx + 1].id);
  return ids;
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
    walk.add('0-5');
    const all = new Set(walk);
    return { walk, knight, elevator, all };
  }

  getAdjacentRooms(currentRoomId).forEach((id) => walk.add(id));
  getSameFloorNeighbors(currentRoomId).forEach((id) => walk.add(id));
  getValidKnightMoves(currentRoomId).forEach((id) => knight.add(id));

  const current = BUILDING_LAYOUT.find((r) => r.id === currentRoomId);
  if (current && ELEVATOR_FLOORS.includes(current.floor) && currentRoomId !== 'ELEVATOR') {
    elevator.add('ELEVATOR');
  }
  if (currentRoomId === 'ELEVATOR') {
    BUILDING_LAYOUT.filter((r) => ELEVATOR_FLOORS.includes(r.floor) && r.id !== 'ELEVATOR').forEach(
      (r) => elevator.add(r.id)
    );
  }

  if (options?.hundredthUnlocked && currentRoomId !== '100-1') {
    walk.add('100-1');
  }

  walk.delete(currentRoomId);
  knight.delete(currentRoomId);
  elevator.delete(currentRoomId);

  const all = new Set<string>([...walk, ...knight, ...elevator]);
  return { walk, knight, elevator, all };
};

export const describeMove = (
  reachable: ReachableMap,
  targetId: string
): 'walk' | 'knight' | 'elevator' | 'blocked' => {
  if (reachable.knight.has(targetId)) return 'knight';
  if (reachable.elevator.has(targetId) && !reachable.walk.has(targetId)) return 'elevator';
  if (reachable.walk.has(targetId)) return 'walk';
  return 'blocked';
};

export { ELEVATOR_COLS, ELEVATOR_FLOORS };
