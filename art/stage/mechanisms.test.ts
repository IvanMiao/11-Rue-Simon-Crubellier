import { strict as assert } from 'node:assert';
import { CASE_EVIDENCE_TEMPLATES, CASE_ITEMS } from '../../case/caseData';
import { MECHANISMS, dropCombinePlan, restPose } from './mechanisms';
import type { SheetLine } from '../../engine/selectors';

const evidenceById = new Map(CASE_EVIDENCE_TEMPLATES.map((item) => [item.id, item]));
const itemsById = new Map(CASE_ITEMS.map((item) => [item.id, item]));

for (const [lineId, spec] of Object.entries(MECHANISMS)) {
  const source = evidenceById.get(lineId) ?? itemsById.get(lineId);
  assert.ok(source, `${lineId} must exist in case evidence or items`);
  assert.equal(spec.lineId, lineId);
  assert.equal(spec.cellId, source.roomId, `${lineId} must match its authored cell`);
}

for (const lineId of [
  'ev-stair-notebook',
  'ev-bb-puzzle',
  'ev-bb-hand',
  'ev-bb-hand-late',
  'ev-wk-bench',
  'it-keyring',
  'it-loupe',
]) {
  assert.ok(MECHANISMS[lineId], `${lineId} needs an authored mechanism`);
}

const statuses: SheetLine['status'][] = ['open', 'locked', 'done', 'failed'];
for (const lineId of Object.keys(MECHANISMS)) {
  for (const hour of [20, 21, 22, 23] as const) {
    for (const status of statuses) {
      const pose = restPose(lineId, status, hour);
      assert.ok(pose >= 0 && pose <= 1, `${lineId} pose must be normalized`);
      assert.equal(pose, restPose(lineId, status, hour), `${lineId} pose must be deterministic`);
    }
    assert.ok(
      restPose(lineId, 'done', hour) >= restPose(lineId, 'open', hour),
      `${lineId} done pose must be at least its open pose`
    );
  }
}

assert.deepEqual(
  dropCombinePlan('shape-x', ['shape-w', 'shape-v'], ['shape-x', 'shape-w']),
  { kind: 'combine', other: 'shape-w' }
);
assert.deepEqual(
  dropCombinePlan('shape-x', ['shape-w', 'shape-v'], ['shape-x', 'shape-w', 'shape-v']),
  { kind: 'choose', options: ['shape-w', 'shape-v'] }
);
assert.deepEqual(
  dropCombinePlan('shape-x', ['shape-x', 'shape-w'], ['shape-x', 'shape-w']),
  { kind: 'combine', other: 'shape-w' },
  'the dragged card is excluded even if the target yields it'
);
assert.deepEqual(
  dropCombinePlan('shape-x', ['shape-w'], ['shape-x']),
  { kind: 'nothing' }
);
assert.deepEqual(
  dropCombinePlan('shape-x', ['shape-w', 'shape-w'], ['shape-x', 'shape-w']),
  { kind: 'combine', other: 'shape-w' },
  'duplicate yielded ids produce one candidate'
);

console.log('mechanism checks passed');
