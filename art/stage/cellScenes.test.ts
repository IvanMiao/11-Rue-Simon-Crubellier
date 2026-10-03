import { strict as assert } from 'node:assert';
import { buildCase, CASE_ROOM_IDS } from '../../case/buildCase';
import { CASE_ITEMS } from '../../case/caseData';
import { FINALE_INTERACTION } from '../../utils/fallbackContent';
import { CELLS, CLINAMEN_CELL } from '../../world/damier';
import { PALETTE } from '../palette';
import { ANCHORS, CELL_ROOM, cellScene } from './cellScenes';

const sceneCells = [...CASE_ROOM_IDS, CLINAMEN_CELL];
for (const cellId of sceneCells) {
  assert.notEqual(cellScene(cellId).kind, 'empty', `${cellId} must have an authored room`);
}

const anchorIds = new Set<string>();
for (const seed of [1, 1975, 0x439]) {
  const graph = buildCase(seed);
  graph.evidence.forEach((evidence) => anchorIds.add(evidence.id));
}
CASE_ITEMS.forEach((item) => anchorIds.add(item.id));
anchorIds.add(FINALE_INTERACTION.id);

for (const id of anchorIds) {
  const anchor = ANCHORS[id];
  assert.ok(anchor, `${id} needs an authored anchor`);
  const [x, y, z] = anchor;
  assert.ok(x >= -CELL_ROOM.W / 2 && x <= CELL_ROOM.W / 2, `${id} x is outside the room`);
  assert.ok(y >= 0 && y <= CELL_ROOM.H, `${id} y is outside the room`);
  assert.ok(z >= -CELL_ROOM.D / 2 && z <= CELL_ROOM.D / 2, `${id} z is outside the room`);
}

assert.equal(CELLS.length, 100);
for (const cell of CELLS) {
  assert.ok(cellScene(cell.id).kind, `${cell.id} must resolve to a room kind`);
  assert.deepEqual(cellScene(cell.id), cellScene(cell.id), `${cell.id} must be deterministic`);
}

for (const cellId of ['3:6', '0:6']) {
  assert.equal(cellScene(cellId).wall, PALETTE.plaster, `${cellId} needs a light base wall`);
  assert.equal(cellScene(cellId).floor, PALETTE.paperDeep, `${cellId} needs a light base floor`);
}
const emptyCell = CELLS.find((cell) => cellScene(cell.id).kind === 'empty')!;
assert.equal(cellScene(emptyCell.id).wall, PALETTE.plaster, `${emptyCell.id} needs a light base wall`);
assert.equal(cellScene(emptyCell.id).floor, PALETTE.paperDeep, `${emptyCell.id} needs a light base floor`);

console.log('cell scene checks passed');
