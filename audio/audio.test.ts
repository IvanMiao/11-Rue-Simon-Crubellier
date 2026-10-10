import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASE_HOUR_PAGES } from '../case/caseData';
import type { GameEvent } from '../engine/types';
import {
  AUDIO_SETTINGS_KEY,
  CUE_MANIFEST,
  DEFAULT_AUDIO_SETTINGS,
  clampAudioSettings,
  parseAudioSettings,
  planBeds,
  serializeAudioSettings,
  stableVariantIndex,
  type Cue,
} from './cues';
import { cuesForGameEvents } from './events';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetDirectory = path.join(root, 'public', 'audio');
const provenance = readFileSync(path.join(root, 'docs', 'audio-provenance.md'), 'utf8');
const entries = Object.entries(CUE_MANIFEST) as [Cue, (typeof CUE_MANIFEST)[Cue]][];
const manifestPaths = entries.flatMap(([, definition]) =>
  definition.variants.flatMap((variant) => variant.map((layer) => layer.path))
);

assert.equal(AUDIO_SETTINGS_KEY, 's3:audio-settings:v1');
assert.equal(new Set(manifestPaths).size, manifestPaths.length, 'Audio paths must not be duplicated.');
assert(manifestPaths.every((assetPath) => assetPath.startsWith('/audio/')));
manifestPaths.forEach((assetPath) => {
  const filename = assetPath.slice('/audio/'.length);
  assert(existsSync(path.join(assetDirectory, filename)), `Missing audio asset ${filename}`);
  assert(provenance.includes(filename), `Missing provenance entry for ${filename}`);
});

const totalBytes = readdirSync(assetDirectory)
  .filter((filename) => filename.endsWith('.ogg'))
  .reduce((total, filename) => total + statSync(path.join(assetDirectory, filename)).size, 0);
assert(totalBytes <= 3 * 1024 * 1024, 'Audio assets must stay within the 3 MiB budget.');

const flipCount = CUE_MANIFEST['paper.flip'].variants.length;
const firstVariant = stableVariantIndex('paper.flip', 'cell:3:6', flipCount);
assert.equal(stableVariantIndex('paper.flip', 'cell:3:6', flipCount), firstVariant);
assert(firstVariant >= 0 && firstVariant < flipCount);
assert.equal(stableVariantIndex('paper.flip', 'cell:3:6', 0), 0);

assert.deepEqual(clampAudioSettings({ muted: true, master: -4, ambience: 135, music: 42.6 }), {
  muted: true,
  master: 0,
  ambience: 100,
  music: 43,
});
const serialized = serializeAudioSettings({ ...DEFAULT_AUDIO_SETTINGS, master: 88, muted: true });
assert.deepEqual(parseAudioSettings(serialized), {
  ...DEFAULT_AUDIO_SETTINGS,
  master: 88,
  muted: true,
});
assert.deepEqual(parseAudioSettings('{bad json'), DEFAULT_AUDIO_SETTINGS);

assert.deepEqual(planBeds('0:3', 20), [{ cue: 'bed.clock', gainDb: -20 }]);
assert.deepEqual(planBeds('3:1', 22), [{ cue: 'bed.clock', gainDb: -20 }]);
assert.deepEqual(planBeds('0:5', 20), []);
assert.deepEqual(planBeds('-1:3', 20), [{ cue: 'bed.boiler', gainDb: -18 }]);
assert.deepEqual(planBeds('-1:3', 23), [
  { cue: 'bed.boiler', gainDb: -18 },
  { cue: 'bed.rain', gainDb: -30 },
]);
assert.deepEqual(planBeds('3:6', 23), [{ cue: 'bed.rain', gainDb: -24 }]);

const walk: GameEvent = {
  type: 'moved',
  from: '3:6',
  to: '3:5',
  kind: 'walk',
  minutes: 5,
  chain: 0,
};
assert.deepEqual(cuesForGameEvents([], {}), [], 'Loaded state alone must not infer one-shot cues.');
const walkCues = cuesForGameEvents([walk], { '3:6': {} }, 'run:1:0');
assert.equal(walkCues.filter(({ cue }) => cue === 'step.wood').length, 2);
assert(walkCues.some(({ cue }) => cue === 'music.chapter'));
assert(!cuesForGameEvents([walk], { '3:6': {}, '3:5': {} }).some(({ cue }) => cue === 'music.chapter'));
assert(cuesForGameEvents([{ ...walk, to: '-1:1' }], {}).some(({ cue }) => cue === 'music.clinamen'));
assert(!cuesForGameEvents([{ ...walk, to: '-1:1' }], { '-1:1': {} }).some(({ cue }) => cue === 'music.clinamen'));

const hourEvent: GameEvent = { type: 'hourTurned', ...CASE_HOUR_PAGES[0] };
assert.deepEqual(cuesForGameEvents([hourEvent], {}).map(({ cue }) => cue), ['hour.bell']);
const failedCombine: GameEvent = { type: 'combined', recipeId: null, text: '未合上' };
assert.deepEqual(cuesForGameEvents([failedCombine], {}).map(({ cue }) => cue), ['drop.nothing']);

const knightCues = cuesForGameEvents(
  [{ ...walk, kind: 'knight', to: '3:5' }],
  { '3:5': {} }
);
assert.deepEqual(knightCues.map(({ cue }) => cue), ['knight.land', 'knight.land']);
const elevatorCues = cuesForGameEvents(
  [{ ...walk, kind: 'elevator', to: '0:7' }],
  { '0:7': {} }
);
assert.deepEqual(elevatorCues.map(({ cue }) => cue), [
  'lift.gate',
  'lift.cable',
  'lift.gate',
  'step.wood',
]);

const checkEvent = {
  type: 'checkRolled',
  roomId: '3:1',
  interactionId: 'ev-bb-hand',
  label: '巴特尔布思的拼图',
  result: { success: true },
  body: '查验结果',
} as unknown as GameEvent;
const checkCues = cuesForGameEvents([checkEvent], {});
assert.deepEqual(checkCues.map(({ cue }) => cue), ['dice.shake', 'dice.throw', 'pencil.tick']);
assert.deepEqual(
  cuesForGameEvents([{ type: 'cardsFound', cards: ['card'], text: '找到' }], {}).map(
    ({ cue }) => cue
  ),
  ['paper.peel', 'paper.land']
);
assert.deepEqual(
  cuesForGameEvents([{ type: 'combined', recipeId: 'recipe', text: '联想成功' }], {}).map(
    ({ cue }) => cue
  ),
  ['paper.peel', 'paper.land']
);
assert.deepEqual(
  cuesForGameEvents(
    [{ type: 'interacted', roomId: '3:1', interactionId: 'line', text: '完成' }],
    {}
  ).map(({ cue }) => cue),
  ['pencil.tick']
);
assert.deepEqual(
  cuesForGameEvents([{ type: 'runEnded', status: 'solved' }], {}).map(({ cue }) => cue),
  ['music.solved']
);

console.log('audio cues, paths, settings, beds, provenance, and event mapping passed');
