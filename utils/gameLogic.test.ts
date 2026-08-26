import { DIFFICULTY_DC } from '../constants/skills';
import { describeMove, getAdjacentRooms, getReachableRooms, getValidKnightMoves } from './gridLogic';
import { applyMorale, applyTime, beginRun, clockLabel, INITIAL_PLAYER_STATE } from './gameLogic';
import { cacheRoom, upgradeRoom } from './gameLogic';
import { performSkillCheck } from './skillCheck';
import { DEFAULT_SKILLS } from '../constants/skills';
import { FALLBACK_BIBLE } from './fallbackContent';
import { BUILDING_LAYOUT } from '../constants';
import { roomsToPrefetch, skeletonForRoom, upgradeRoomContent } from './roomRuntime';
import { floorLabel, stillLifeKind, roomLook } from './roomArt';
import { layoutRooms } from './sectionLayout';

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

const hall = BUILDING_LAYOUT.find((r) => r.id === '0-5')!;
const skeleton = skeletonForRoom(hall, 42, started.character, false);
assert(skeleton.source === 'skeleton', 'skeleton source');
assert((skeleton.available_interactions || []).length > 0, 'skeleton has checks');

const withSkeleton = cacheRoom(started, hall.id, skeleton);
assert(withSkeleton.roomsVisitedCount === 1, 'first visit counts');
assert(withSkeleton.xp === 1, 'first visit xp');

const authored = {
  ...skeleton,
  source: 'authored' as const,
  text: 'LLM 写的更长的正文。',
  collectible_item: {
    id: 'llm-item',
    name: '一枚新邮票',
    description: '作者后来才看见的东西。',
    type: 'regular' as const,
  },
};
const upgraded = upgradeRoom(withSkeleton, hall.id, authored);
assert(upgraded.roomsVisitedCount === 1, 'upgrade does not recount visit');
assert(upgraded.xp === 1, 'upgrade does not grant xp again');
assert(upgraded.visitedRooms[hall.id].text === 'LLM 写的更长的正文。', 'prose replaced');
assert(upgraded.visitedRooms[hall.id].source === 'authored', 'source authored');

const acted = {
  ...skeleton,
  journal: ['> 翻看'],
  consumed_interaction_ids: [`${hall.id}-look`],
};
const mergedActed = upgradeRoomContent(acted, authored);
assert(mergedActed.available_interactions === acted.available_interactions, 'keep checks after acting');
assert(mergedActed.journal?.[0] === '> 翻看', 'keep journal');

const taken = upgradeRoomContent(
  { ...skeleton, collectible_taken: true, collectible_item: undefined },
  authored
);
assert(taken.collectible_item === undefined, 'taken item stays taken');

const prefetch = roomsToPrefetch(reachable, '0-5', { '0-5': skeleton });
assert(!prefetch.includes('0-5'), 'do not prefetch current');
assert(prefetch.length > 0, 'neighbors queued');
assert(prefetch.length <= 6, 'prefetch cap');

assert(floorLabel(0) === 'RC', 'rez-de-chaussée');
assert(floorLabel(-1) === 'SS', 'sous-sol');
assert(floorLabel(8) === '8e', 'attic floor');
assert(stillLifeKind('一枚缺角的邮票') === 'stamp', 'stamp icon');
assert(stillLifeKind('一盘下到中盘的国际象棋') === 'chess', 'chess icon');
const hallLook = roomLook(hall);
assert(hallLook.lamp.length > 0, 'hall has a lamp');
assert(roomLook(hall).lamp === hallLook.lamp, 'room art is deterministic');

const boxes = layoutRooms(false);
const hallBox = boxes.find((b) => b.id === '0-5');
assert(hallBox, 'hall is in 3d layout');
const elevatorBox = boxes.find((b) => b.id === 'ELEVATOR');
assert(elevatorBox && elevatorBox.h > hallBox!.h, 'elevator shaft is taller than the hall');
const attic = boxes.filter((b) => b.room.floor === 8);
const cellar = boxes.filter((b) => b.room.floor === -1);
assert(attic[0].y > cellar[0].y, 'attic sits above the cellar');
assert(!boxes.some((b) => b.room.floor === 100), 'hundredth floor hidden by default');
assert(layoutRooms(true).some((b) => b.room.floor === 100), 'hundredth floor can appear');

console.log('game logic checks passed');
