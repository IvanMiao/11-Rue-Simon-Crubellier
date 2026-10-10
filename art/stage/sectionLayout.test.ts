import assert from 'node:assert/strict';
import {
  cellAtPoint,
  cellOrigin3d,
  detailTier,
  flightPath,
  frameFor,
  SECTION_CELL_IDS,
  SECTION_PITCH,
} from './sectionLayout';
import { CELL_BY_ID, CELLS, CLINAMEN_CELL } from '../../world/damier';
import { CELL_ROOM } from './cellScenes';

const knightOffsets: Array<[number, number]> = [
  [2, 1], [2, -1], [-2, 1], [-2, -1],
  [1, 2], [1, -2], [-1, 2], [-1, -2],
];

function projectToFrame(
  point: [number, number, number],
  target: [number, number, number],
  yaw: number,
  pitch: number
): [number, number] {
  const dx = point[0] - target[0];
  const dy = point[1] - target[1];
  const dz = point[2] - target[2];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up = [
    -Math.sin(yaw) * Math.sin(pitch),
    Math.cos(pitch),
    -Math.cos(yaw) * Math.sin(pitch),
  ];
  return [
    dx * right[0] + dy * right[1] + dz * right[2],
    dx * up[0] + dy * up[1] + dz * up[2],
  ];
}

for (const id of SECTION_CELL_IDS) {
  const [x, y] = cellOrigin3d(id);
  assert.equal(cellAtPoint(x, y), id, `${id} should round-trip through the front plane`);
}
assert.equal(SECTION_CELL_IDS.length, 100);
assert.equal(cellAtPoint(-100, 0), null);
assert.equal(cellAtPoint(0, 100), null);

for (const start of ['8:1', '6:6', '3:6', '0:10', '-1:10', '-1:2']) {
  const source = CELL_BY_ID[start];
  const frame = frameFor('block', start, 16 / 9);
  const halfWidth = (frame.viewHeight * 16 / 9) / 2;
  const halfHeight = frame.viewHeight / 2;
  for (const [df, dc] of knightOffsets) {
    const destination = CELL_BY_ID[`${source.floor + df}:${source.col + dc}`];
    if (!destination) continue;
    const point = cellOrigin3d(destination.id);
    const [screenX, screenY] = projectToFrame(
      point,
      frame.target,
      frame.yaw,
      frame.pitch
    );
    assert.ok(
      Math.abs(screenX) <= halfWidth && Math.abs(screenY) <= halfHeight,
      `${start} block frame should contain knight destination ${destination.id}`
    );
  }
}

assert.deepEqual(flightPath('3:6', '1:5', 'knight'), ['3:6', '1:6', '1:5']);
assert.deepEqual(flightPath('3:6', '4:4', 'knight'), ['3:6', '3:4', '4:4']);
assert.deepEqual(flightPath('3:6', '3:7', 'walk'), ['3:6', '3:7']);
assert.deepEqual(flightPath('0:7', '-1:7', 'elevator'), ['0:7', '-1:7']);

const allVisited = new Set(SECTION_CELL_IDS);
for (const focus of ['3:6', '8:1', '-1:10']) {
  const counts = { room: 0, painted: 0, sketch: 0, void: 0 };
  for (const cell of CELLS) counts[detailTier(cell.id, focus, allVisited, 'room')] += 1;
  assert.ok(counts.room <= 9, `${focus} has at most nine full rooms`);
  assert.equal(counts.sketch, 0);
  assert.equal(counts.painted + counts.room + counts.void, 100);
}
assert.equal(detailTier(CLINAMEN_CELL, '3:6', new Set(), 'room'), 'void');
assert.equal(detailTier('3:6', '3:6', new Set(), 'room'), 'room');
assert.equal(detailTier('3:7', '3:6', new Set(), 'room'), 'room');
assert.equal(detailTier('8:1', '3:6', new Set(['8:1']), 'room'), 'painted');
assert.equal(detailTier('8:1', '3:6', new Set(), 'room'), 'sketch');
assert.equal(detailTier('3:7', '3:6', new Set(), 'building'), 'sketch');
assert.equal(detailTier('3:7', '3:6', new Set(['3:7']), 'building'), 'painted');
assert.equal(detailTier('3:6', '3:6', new Set(), 'building'), 'room');
const buildingCounts = { room: 0, painted: 0, sketch: 0, void: 0 };
for (const cell of CELLS) {
  buildingCounts[detailTier(cell.id, '3:6', allVisited, 'building')] += 1;
}
assert.equal(buildingCounts.room, 1);
assert.equal(buildingCounts.painted, 98);
assert.equal(buildingCounts.void, 1);
const roomFrame = frameFor('room', '3:6', 16 / 9);
assert.ok(Math.abs(roomFrame.target[1] - (3 * SECTION_PITCH.y + 1.5)) < 1e-9);
assert.ok(Math.abs((roomFrame.yaw * 180) / Math.PI - 23) < 1e-9);
assert.ok(Math.abs((roomFrame.pitch * 180) / Math.PI - 10) < 1e-9);
const roomWidth = roomFrame.viewHeight * (16 / 9);
const neighbourShare = (roomWidth - 3.4) / (2 * SECTION_PITCH.x);
assert.ok(neighbourShare >= 0.2 && neighbourShare <= 0.35);
const gameRoomFrame = frameFor('room', '3:6', 1.14);
const gameRoomWidth = gameRoomFrame.viewHeight * 1.14;
const gameNeighbourShare = (gameRoomWidth - CELL_ROOM.W) / (2 * SECTION_PITCH.x);
assert.ok(gameNeighbourShare >= 0.2 && gameNeighbourShare <= 0.3);
assert.ok(CELL_ROOM.H / gameRoomFrame.viewHeight >= 0.65);
const clinamenFrame = frameFor('room', CLINAMEN_CELL, 16 / 9);
assert.equal(clinamenFrame.viewHeight, 4.4);
assert.equal(SECTION_PITCH.x, 3.52);
assert.equal(SECTION_PITCH.y, 3.24);
assert.equal(CELL_BY_ID['-1:1'].id, CLINAMEN_CELL);

console.log('Section layout: 100 cell inverses, block routes, knight corners and detail tiers passed');
