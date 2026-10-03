import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHETYPES } from '../constants/skills';
import { caseBot, guessBot, randomBot, runBot, Bot } from '../engine/bots';
import { replay } from '../engine/save';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argIndex = process.argv.indexOf('--seeds');
const seedCount = argIndex >= 0 ? Number(process.argv[argIndex + 1]) : 2000;
if (!Number.isInteger(seedCount) || seedCount <= 0) {
  throw new Error('--seeds must be a positive integer');
}

const bots: Array<{ name: string; run: Bot }> = [
  { name: 'randomBot', run: randomBot },
  { name: 'caseBot', run: caseBot },
  { name: 'guessBot', run: guessBot },
];

type SimRow = {
  bot: string;
  archetype: string;
  seeds: number;
  grade3: number;
  grade2Plus: number;
  meanLockedGroups: number;
  meanWrongSubmissions: number;
  meanSolveMinute: number | null;
  midnight: number;
  collapsed: number;
  trapped: number;
};

const rows: SimRow[] = [];
let trappedRuns = 0;
let replayFailures = 0;
let replaySamples = 0;
const mean = (values: number[]): number | null =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
const samplesPerRow = 6;

for (const bot of bots) {
  for (let archetypeIdx = 0; archetypeIdx < ARCHETYPES.length; archetypeIdx += 1) {
    const outcomes = Array.from({ length: seedCount }, (_, index) =>
      runBot(bot.run, 1000 + index * 7919, archetypeIdx)
    );
    const solved = outcomes.filter((outcome) => outcome.status === 'solved');
    const row: SimRow = {
      bot: bot.name,
      archetype: ARCHETYPES[archetypeIdx].id,
      seeds: seedCount,
      grade3: outcomes.filter((outcome) => outcome.grade === 3).length,
      grade2Plus: outcomes.filter((outcome) => (outcome.grade ?? 0) >= 2).length,
      meanLockedGroups: mean(outcomes.map((outcome) => outcome.lockedGroups)) ?? 0,
      meanWrongSubmissions: mean(outcomes.map((outcome) => outcome.wrongSubmissions)) ?? 0,
      meanSolveMinute: mean(solved.map((outcome) => outcome.minutes)),
      midnight: outcomes.filter((outcome) => outcome.status === 'midnight').length,
      collapsed: outcomes.filter((outcome) => outcome.status === 'collapsed').length,
      trapped: outcomes.filter((outcome) => outcome.trapped).length,
    };
    rows.push(row);
    trappedRuns += row.trapped;

    for (const outcome of outcomes.slice(0, samplesPerRow)) {
      replaySamples += 1;
      if (JSON.stringify(replay(outcome.actions)) !== JSON.stringify(outcome.finalState)) {
        replayFailures += 1;
      }
    }
  }
}

const percent = (count: number) => `${((100 * count) / seedCount).toFixed(1)}%`;
console.log(
  [
    'bot / archetype',
    'grade 3',
    'grade ≥2',
    'mean locked groups',
    'mean wrong submissions',
    'mean solve minute',
    'midnight',
    'collapsed',
    'trapped',
  ].join(' | ')
);
rows.forEach((row) => {
  console.log(
    [
      `${row.bot} / ${row.archetype}`,
      percent(row.grade3),
      percent(row.grade2Plus),
      row.meanLockedGroups.toFixed(2),
      row.meanWrongSubmissions.toFixed(2),
      row.meanSolveMinute === null ? '—' : row.meanSolveMinute.toFixed(1),
      percent(row.midnight),
      percent(row.collapsed),
      percent(row.trapped),
    ].join(' | ')
  );
});

fs.writeFileSync(
  path.join(root, 'sim-report.json'),
  `${JSON.stringify({ seeds: seedCount, rows, trappedRuns, replayFailures, replaySamples }, null, 2)}\n`
);

const caseBotPass = rows
  .filter((row) => row.bot === 'caseBot')
  .every((row) => (100 * row.grade2Plus) / seedCount >= 70);
const guessBotPass = rows
  .filter((row) => row.bot === 'guessBot')
  .every((row) => (100 * row.grade2Plus) / seedCount <= 15);
const trappedPass = trappedRuns === 0;
const replayPass = replayFailures === 0 && replaySamples > 0;
console.log(`Replay determinism: ${replaySamples - replayFailures}/${replaySamples} sample runs matched.`);
if (!caseBotPass || !guessBotPass || !trappedPass || !replayPass) {
  console.error(
    `Simulation failed: caseBot grade ≥2 gate=${caseBotPass}, guessBot grade ≥2 gate=${guessBotPass}, trapped runs=${trappedRuns}, replay mismatches=${replayFailures}/${replaySamples}`
  );
  process.exitCode = 1;
}
