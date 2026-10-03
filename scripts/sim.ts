import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHETYPES } from '../constants/skills';
import { detectiveBot, knightBot, randomBot, runBot, Bot } from '../engine/bots';
import { replay } from '../engine/save';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argIndex = process.argv.indexOf('--seeds');
const seedCount = argIndex >= 0 ? Number(process.argv[argIndex + 1]) : 2000;
if (!Number.isInteger(seedCount) || seedCount <= 0) {
  throw new Error('--seeds must be a positive integer');
}

const bots: Array<{ name: string; run: Bot }> = [
  { name: 'random', run: randomBot },
  { name: 'knight', run: knightBot },
  { name: 'detective', run: detectiveBot },
];

type SimRow = {
  bot: string;
  archetype: string;
  seeds: number;
  solved: number;
  midnight: number;
  collapsed: number;
  unlocked: number;
  meanUnlockMinute: number | null;
  meanRooms: number;
  meanChecks: number;
  trapped: number;
};

const rows: SimRow[] = [];
let trappedRuns = 0;
let replayFailures = 0;
let replaySamples = 0;

const mean = (values: number[]) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;

for (const bot of bots) {
  for (let archetypeIdx = 0; archetypeIdx < ARCHETYPES.length; archetypeIdx += 1) {
    const outcomes = Array.from({ length: seedCount }, (_, index) =>
      runBot(bot.run, 1000 + index * 7919, archetypeIdx)
    );
    const unlocked = outcomes.filter((outcome) => outcome.unlockAt !== null);
    const row: SimRow = {
      bot: bot.name,
      archetype: ARCHETYPES[archetypeIdx].id,
      seeds: seedCount,
      solved: outcomes.filter((outcome) => outcome.status === 'solved').length,
      midnight: outcomes.filter((outcome) => outcome.status === 'midnight').length,
      collapsed: outcomes.filter((outcome) => outcome.status === 'collapsed').length,
      unlocked: unlocked.length,
      meanUnlockMinute: mean(unlocked.map((outcome) => outcome.unlockAt!)),
      meanRooms: mean(outcomes.map((outcome) => outcome.rooms))!,
      meanChecks: mean(outcomes.map((outcome) => outcome.checks))!,
      trapped: outcomes.filter((outcome) => outcome.trapped).length,
    };
    rows.push(row);
    trappedRuns += row.trapped;

    for (const outcome of outcomes) {
      if (replaySamples >= 50) break;
      replaySamples += 1;
      if (JSON.stringify(replay(outcome.actions)) !== JSON.stringify(outcome.finalState)) {
        replayFailures += 1;
      }
    }
  }
}

const pct = (count: number) => `${((100 * count) / seedCount).toFixed(1)}%`;
console.log(
  [
    'bot / archetype',
    'solved',
    'midnight',
    'collapsed',
    'unlocked',
    'mean unlock min',
    'mean rooms',
    'mean checks',
    'trapped',
  ].join(' | ')
);
rows.forEach((row) => {
  console.log(
    [
      `${row.bot} / ${row.archetype}`,
      pct(row.solved),
      pct(row.midnight),
      pct(row.collapsed),
      pct(row.unlocked),
      row.meanUnlockMinute === null ? '—' : row.meanUnlockMinute.toFixed(1),
      row.meanRooms.toFixed(1),
      row.meanChecks.toFixed(1),
      pct(row.trapped),
    ].join(' | ')
  );
});

fs.writeFileSync(
  path.join(root, 'sim-report.json'),
  `${JSON.stringify({ seeds: seedCount, rows }, null, 2)}\n`
);

if (trappedRuns > 0 || replayFailures > 0 || replaySamples !== 50) {
  console.error(
    `Simulation failed: trapped runs=${trappedRuns}, replay mismatches=${replayFailures}/${replaySamples}`
  );
  process.exitCode = 1;
} else {
  console.log(`Replay determinism: ${replaySamples}/${replaySamples} sample runs matched.`);
}
