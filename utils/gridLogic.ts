import { BUILDING_LAYOUT } from '../constants';

// Map of RoomID -> Array of {row, col} coordinates
// Grid is 10x10. Rows 0-9, Cols 0-9.
// Floor 8 -> Row 0
// Floor -1 -> Row 9
interface GridCell {
    row: number;
    col: number;
}

const GRID_SIZE = 10;

// Helper to convert floor number to grid row index
const floorToRow = (floor: number): number => {
    // Floors: 8, 7, 6, 5, 4, 3, 2, 1, 0, -1
    // Rows:   0, 1, 2, 3, 4, 5, 6, 7, 8, 9
    return 8 - floor;
};

// Build the map of room IDs to their occupied grid cells
const buildRoomGridMap = (): Record<string, GridCell[]> => {
    const map: Record<string, GridCell[]> = {};

    // We need to track the current column for each row as we iterate through rooms
    // Since BUILDING_LAYOUT is ordered by floor, we can process it.
    // However, the layout array is flat. We need to process floor by floor.

    const floors = [8, 7, 6, 5, 4, 3, 2, 1, 0, -1];

    floors.forEach(floor => {
        const roomsOnFloor = BUILDING_LAYOUT.filter(r => r.floor === floor);
        let currentCol = 0;
        const rowStart = floorToRow(floor);

        roomsOnFloor.forEach(room => {
            const roomCells: GridCell[] = [];
            const colSpan = room.colSpan || 1;
            const rowSpan = room.rowSpan || 1;

            // For each cell this room occupies
            for (let r = 0; r < rowSpan; r++) {
                for (let c = 0; c < colSpan; c++) {
                    roomCells.push({
                        row: rowStart + r,
                        col: currentCol + c
                    });
                }
            }

            if (!map[room.id]) {
                map[room.id] = [];
            }
            map[room.id].push(...roomCells);

            // Advance column pointer for the *next* room on this floor
            // Note: This assumes simple left-to-right layout without complex wrapping or holes
            // The constants.ts implies a strict grid.
            // However, for rooms with rowSpan > 1 (like Elevator), they "occupy" space on lower floors too.
            // But the BUILDING_LAYOUT defines them on their "start" floor.
            // We need to be careful not to double-count columns on lower floors if we were strictly iterating.
            // But here we are just mapping ID -> Cells.
            // The visual grid in BuildingMap uses grid-column/row spans, relying on CSS Grid auto-placement or explicit placement.
            // BuildingMap.tsx uses explicit order.

            currentCol += colSpan;
        });
    });

    return map;
};

const roomGridMap = buildRoomGridMap();

// Get all valid Knight's moves from a given room
export const getValidKnightMoves = (currentRoomId: string): string[] => {
    const currentCells = roomGridMap[currentRoomId];
    if (!currentCells) return [];

    const validTargetIds = new Set<string>();

    // Knight's move offsets
    const moves = [
        { r: -2, c: -1 }, { r: -2, c: 1 },
        { r: -1, c: -2 }, { r: -1, c: 2 },
        { r: 1, c: -2 }, { r: 1, c: 2 },
        { r: 2, c: -1 }, { r: 2, c: 1 }
    ];

    currentCells.forEach(cell => {
        moves.forEach(move => {
            const newRow = cell.row + move.r;
            const newCol = cell.col + move.c;

            if (newRow >= 0 && newRow < GRID_SIZE && newCol >= 0 && newCol < GRID_SIZE) {
                // Find which room occupies this cell
                // This is inefficient (O(N)), but N is small (~70 rooms).
                // Could optimize with a reverse map (Cell -> RoomID) if needed.
                const targetRoomId = findRoomAt(newRow, newCol);
                if (targetRoomId && targetRoomId !== currentRoomId) {
                    validTargetIds.add(targetRoomId);
                }
            }
        });
    });

    return Array.from(validTargetIds);
};

const findRoomAt = (row: number, col: number): string | undefined => {
    for (const [id, cells] of Object.entries(roomGridMap)) {
        if (cells.some(c => c.row === row && c.col === col)) {
            return id;
        }
    }
    return undefined;
};
