import assert from 'node:assert/strict';
import { cellOrigin3d, flightPath, SECTION_PITCH } from './sectionLayout';
import { playerSpot } from './cellScenes';
import { moveTimeline } from './motion';

function expectedPosition(cellId: string): [number, number, number] {
  const origin = cellOrigin3d(cellId);
  const spot = playerSpot(cellId);
  return [origin[0] + spot[0], origin[1] + spot[1], origin[2] + spot[2]];
}

function assertTimeline(path: string[], kind: 'walk' | 'knight' | 'elevator') {
  const timeline = moveTimeline(path, kind);
  assert.ok(timeline.keys.length >= 2);
  timeline.keys.slice(1).forEach((key, index) => {
    assert.ok(key.t > timeline.keys[index].t, `${kind} key times must strictly increase`);
  });
  assert.deepEqual(timeline.keys[0].pos, expectedPosition(path[0]));
  assert.deepEqual(timeline.keys[timeline.keys.length - 1].pos, expectedPosition(path[path.length - 1]));
  assert.deepEqual(timeline, moveTimeline(path, kind), `${kind} timeline must be deterministic`);
  return timeline;
}

const walk = assertTimeline(['3:6', '3:5'], 'walk');
assert.equal(walk.duration, 420);
assert.ok(walk.keys.some((key) => key.hop && key.hop > 0));

const knightPath = flightPath('3:6', '1:5', 'knight');
const knight = assertTimeline(knightPath, 'knight');
assert.deepEqual(knightPath, ['3:6', '1:6', '1:5']);
assert.equal(knight.duration, 1200);

const elevator = assertTimeline(['0:6', '6:6'], 'elevator');
assert.ok(elevator.duration <= 4500);
const liftX = cellOrigin3d('0:7')[0];
const shaftKeys = elevator.keys.filter(
  (key) => key.pos[1] > 0.25 && key.pos[1] < 6 * SECTION_PITCH.y - 0.25
);
assert.ok(shaftKeys.length > 0);
shaftKeys.forEach((key) => {
  assert.ok(Math.abs(key.pos[0] - liftX) < 1e-9, 'elevator ride keys stay in the lift column');
});

for (const kind of ['walk', 'knight', 'elevator'] as const) {
  for (const path of [['3:6', '3:5'], ['3:6', '1:5']]) {
    const result = moveTimeline(path, kind);
    result.keys.slice(1).forEach((key, index) => {
      assert.ok(key.t > result.keys[index].t);
    });
  }
}

console.log('Movement timelines: endpoints, timing, lift column and determinism passed');
