import { DIFFICULTY_DC } from '../constants/skills';
import { describeMove, getAdjacentRooms, getReachableRooms, getValidKnightMoves } from './gridLogic';
import { applyMorale, applyTime, beginRun, clockLabel, INITIAL_PLAYER_STATE } from './gameLogic';
import { performSkillCheck } from './skillCheck';
import { DEFAULT_SKILLS } from '../constants/skills';
import { FALLBACK_BIBLE } from './fallbackContent';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const hallNeighbors = getAdjacentRooms('0-5');
assert(hallNeighbors.includes('ELEVATOR'), `HALL should touch elevator, got ${hallNeighbors.join(',')}`);

const knightFromHall = getValidKnightMoves('0-5');
assert(knightFromHall.length > 0, 'HALL should have knight moves');

const reachable = getReachableRooms('0-5');
assert(reachable.all.size > 0, 'HALL must have destinations');
assert(describeMove(reachable, 'ELEVATOR') !== 'blocked', 'Elevator should be reachable from HALL');

const check = performSkillCheck({
  skill: 'logic',
  skillValue: 3,
  difficulty: 'medium',
  seed: 1,
  salt: 'test-a',
});
assert(check.die1 >= 1 && check.die1 <= 6, 'die1 range');
assert(check.die2 >= 1 && check.die2 <= 6, 'die2 range');
assert(check.dc === DIFFICULTY_DC.medium, 'medium DC');
assert(check.total === check.die1 + check.die2 + 3, 'total math');
assert(check.success === check.total >= check.dc, 'success flag');

const same = performSkillCheck({
  skill: 'logic',
  skillValue: 3,
  difficulty: 'medium',
  seed: 1,
  salt: 'test-a',
});
assert(same.die1 === check.die1 && same.die2 === check.die2, 'seeded dice are deterministic');

assert(clockLabel(0) === '20:00', 'start clock');
assert(clockLabel(90) === '21:30', 'clock plus 90');

const midnight = applyTime(INITIAL_PLAYER_STATE, 240);
assert(midnight.runStatus === 'creating' || midnight.minutesPastEight >= 240, 'time applies');

const playing = { ...INITIAL_PLAYER_STATE, runStatus: 'playing' as const };
assert(applyTime(playing, 240).runStatus === 'midnight', 'midnight ending');
assert(applyMorale(playing, -99).runStatus === 'collapsed', 'collapse ending');

const started = beginRun(
  {
    name: 'Test',
    archetype: '棋手',
    skills: { ...DEFAULT_SKILLS(), constraint: 4 },
    signatureThought: 'x',
  },
  42,
  FALLBACK_BIBLE
);
assert(started.currentRoomId === '0-5', 'start in hall');
assert(started.plotThreads.length === FALLBACK_BIBLE.plot_threads.length, 'threads copied');

console.log('game logic checks passed');
