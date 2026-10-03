import { ARCHETYPES, DEFAULT_SKILLS, SKILL_MAX, THOUGHT_SLOTS } from '../constants/skills';
import { BUILDING_LAYOUT } from '../constants';
import type { Character, PlayerState, RunStatus, SkillId } from '../types';
import { describeMove, getReachableRooms } from '../utils/gridLogic';
import { INITIAL_PLAYER_STATE, hundredthUnlocked, moveTimeCost } from '../utils/gameLogic';
import { fallbackRoom } from '../utils/fallbackContent';
import { mulberry32 } from '../utils/rng';
import { buildCase, caseBible, caseRoomContent, CASE_ROOM_IDS } from '../case/buildCase';
import { CASE_ITEMS } from '../case/caseData';
import type { CaseEvidence, CaseGraph } from '../case/types';
import { Action } from './types';
import {
  isCombineAvailable,
  isInteractionAvailable,
  roomsWithAvailableEvidence,
  step,
} from './step';

export type Bot = (state: PlayerState, actions: Action[], random: () => number) => Action | null;

function randomIndex(random: () => number, length: number): number {
  return Math.floor(random() * length);
}

function currentInteractions(state: PlayerState): Action[] {
  const roomId = state.currentRoomId;
  const room = roomId ? state.visitedRooms[roomId] : undefined;
  if (!roomId || !room) return [];
  return (room.available_interactions || [])
    .map((interaction) => interaction.id || interaction.label)
    .filter((interactionId) => isInteractionAvailable(state, interactionId))
    .map((interactionId) => ({ type: 'interact' as const, interactionId }));
}

function moveOptions(state: PlayerState, excludeFinale = false): string[] {
  if (!state.currentRoomId) return [];
  const reachable = getReachableRooms(state.currentRoomId, {
    hundredthUnlocked: hundredthUnlocked(state),
  });
  return [...reachable.all].filter((roomId) => !excludeFinale || roomId !== '100-1');
}

function pickMove(
  state: PlayerState,
  random: () => number,
  options: { preferUnvisited?: boolean; preferKnight?: boolean; excludeFinale?: boolean } = {}
): Action | null {
  const targets = moveOptions(state, options.excludeFinale);
  const reachable = getReachableRooms(state.currentRoomId, {
    hundredthUnlocked: hundredthUnlocked(state),
  });
  let candidates = options.preferUnvisited
    ? targets.filter((roomId) => !state.visitedRooms[roomId])
    : targets;
  if (candidates.length === 0) candidates = targets;
  if (options.preferKnight) {
    const knightMoves = candidates.filter((roomId) => reachable.knight.has(roomId));
    if (knightMoves.length > 0) candidates = knightMoves;
  }
  if (candidates.length === 0) return null;
  return { type: 'move', roomId: candidates[randomIndex(random, candidates.length)] };
}

function supportActions(state: PlayerState, random: () => number): Action[] {
  const actions: Action[] = [];
  const roomId = state.currentRoomId;
  const collectible = roomId ? state.visitedRooms[roomId]?.collectible_item : undefined;
  if (collectible && !state.inventory.some((item) => item.id === collectible.id)) {
    actions.push({ type: 'collect', itemId: collectible.id });
  }
  if (state.thoughts.filter((thought) => thought.internalized).length < THOUGHT_SLOTS) {
    state.thoughts
      .filter((thought) => !thought.internalized)
      .forEach((thought) => actions.push({ type: 'internalize', thoughtId: thought.id }));
  }
  if (state.pendingSkillPoints > 0 && state.character) {
    const skills = Object.keys(state.character.skills) as SkillId[];
    const availableSkills = skills.filter((id) => state.character!.skills[id] < SKILL_MAX);
    const skill = availableSkills[randomIndex(random, availableSkills.length)];
    if (skill) actions.push({ type: 'spendPoint', skill });
  }
  return actions;
}

function neededCaseCards(state: PlayerState, graph: CaseGraph): Set<string> {
  if (!state.case) return new Set();
  const needed = new Set(
    graph.slots
      .filter((slot) => !state.case!.lockedGroups.includes(slot.groupId))
      .map((slot) => slot.answer)
      .filter((cardId) => !state.case!.cards.includes(cardId))
  );
  let changed = true;
  while (changed) {
    changed = false;
    graph.recipes.forEach((recipe) => {
      if (
        state.case!.usedRecipes.includes(recipe.id) ||
        !recipe.cards.some((cardId) => needed.has(cardId))
      ) {
        return;
      }
      recipe.pair.forEach((cardId) => {
        if (!state.case!.cards.includes(cardId) && !needed.has(cardId)) {
          needed.add(cardId);
          changed = true;
        }
      });
    });
  }
  return needed;
}

function evidenceProvidesNeededCard(
  state: PlayerState,
  evidence: CaseEvidence,
  needed: Set<string>
): boolean {
  if (!state.case || needed.size === 0) return true;
  return [...evidence.cards, ...(evidence.failCards || [])].some(
    (cardId) => needed.has(cardId) && !state.case!.cards.includes(cardId)
  );
}

function evidenceRoomsForNeededCards(
  state: PlayerState,
  graph: CaseGraph,
  needed: Set<string>
): string[] {
  const availableRooms = roomsWithAvailableEvidence(state, { checkMorale: true });
  if (needed.size === 0) return availableRooms;
  return availableRooms.filter((roomId) =>
    graph.evidence.some(
      (evidence) =>
        evidence.roomId === roomId && evidenceProvidesNeededCard(state, evidence, needed)
    )
  );
}

function requiredItemRoomsForNeededCards(
  state: PlayerState,
  graph: CaseGraph,
  needed: Set<string>
): string[] {
  if (!state.case || needed.size === 0) return [];
  const required = new Set(
    graph.evidence
      .filter(
        (evidence) =>
          evidence.requiresItem &&
          !state.inventory.some((item) => item.id === evidence.requiresItem) &&
          evidenceProvidesNeededCard(state, evidence, needed)
      )
      .map((evidence) => evidence.requiresItem!)
  );
  return CASE_ITEMS.filter(
    (item) => required.has(item.id) && !state.inventory.some((owned) => owned.id === item.id)
  ).map((item) => item.roomId);
}

function nextStepTo(state: PlayerState, targets: string[]): Action | null {
  const start = state.currentRoomId;
  if (!start || targets.length === 0) return null;
  const targetSet = new Set(targets.filter((target) => target !== start));
  if (!targetSet.size) return null;
  const distances = new Map<string, number>([[start, 0]]);
  const firstHop = new Map<string, string>();
  const visited = new Set<string>();

  while (true) {
    let current: string | undefined;
    let shortest = Number.POSITIVE_INFINITY;
    distances.forEach((distance, roomId) => {
      if (!visited.has(roomId) && distance < shortest) {
        shortest = distance;
        current = roomId;
      }
    });
    if (!current) return null;
    if (targetSet.has(current)) {
      const roomId = firstHop.get(current);
      return roomId ? { type: 'move', roomId } : null;
    }
    visited.add(current);
    const reachable = getReachableRooms(current, {
      hundredthUnlocked: hundredthUnlocked(state),
    });
    reachable.all.forEach((neighbor) => {
      if (visited.has(neighbor)) return;
      const kind = describeMove(reachable, neighbor);
      if (kind === 'blocked') return;
      const distance = shortest + moveTimeCost(kind, state);
      if (distance < (distances.get(neighbor) ?? Number.POSITIVE_INFINITY)) {
        distances.set(neighbor, distance);
        firstHop.set(neighbor, current === start ? neighbor : firstHop.get(current)!);
      }
    });
  }
}

function hasCloseCondition(state: PlayerState): boolean {
  const groups = state.case?.lockedGroups.length ?? 0;
  return groups === 3 || (groups >= 2 && state.minutesPastEight >= 180);
}

function nextSkillPoint(state: PlayerState): SkillId | null {
  if (!state.character || state.pendingSkillPoints <= 0 || !state.case) return null;
  const priorities: SkillId[] = [state.case.handSkill, 'inland', 'encyclopedia'];
  return priorities.find((skill) => state.character!.skills[skill] < SKILL_MAX) || null;
}

function currentCaseEvidence(
  state: PlayerState,
  graph: CaseGraph,
  kind: 'look' | 'check',
  needed?: Set<string>
): Action | null {
  const roomId = state.currentRoomId;
  if (!roomId) return null;
  const evidence = graph.evidence.find(
    (candidate) =>
      candidate.roomId === roomId &&
      candidate.kind === kind &&
      isInteractionAvailable(state, candidate.id) &&
      (!needed || evidenceProvidesNeededCard(state, candidate, needed))
  );
  return evidence ? { type: 'interact', interactionId: evidence.id } : null;
}

function fallbackMove(state: PlayerState, random: () => number): Action | null {
  return pickMove(state, random, { preferUnvisited: true }) || pickMove(state, random);
}

function randomBoardAction(state: PlayerState, graph: CaseGraph, random: () => number): Action | null {
  if (!state.case) return null;
  const availableSlots = graph.slots.filter(
    (slot) => !state.case!.lockedGroups.includes(slot.groupId)
  );
  if (availableSlots.length && state.case.cards.length) {
    const slot = availableSlots[randomIndex(random, availableSlots.length)];
    const occupiedElsewhere = new Set(
      Object.entries(state.case.slots)
        .filter(([slotId, cardId]) => slotId !== slot.id && cardId)
        .map(([, cardId]) => cardId!)
    );
    const candidates = state.case.cards.filter((cardId) => {
      const card = graph.cards.find((candidate) => candidate.id === cardId);
      return Boolean(card && slot.accepts.includes(card.kind) && !occupiedElsewhere.has(cardId));
    });
    if (candidates.length) {
      return {
        type: 'placeCard',
        slotId: slot.id,
        cardId: candidates[randomIndex(random, candidates.length)],
      };
    }
  }
  if (state.case.cards.length >= 2 && random() < 0.5) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < state.case.cards.length; i += 1) {
      for (let j = i + 1; j < state.case.cards.length; j += 1) {
        const a = state.case.cards[i];
        const b = state.case.cards[j];
        if (isCombineAvailable(state, a, b)) pairs.push([a, b]);
      }
    }
    if (pairs.length) {
      const [a, b] = pairs[randomIndex(random, pairs.length)];
      return { type: 'combine', a, b };
    }
  }
  const fullGroup = graph.groups.find(
    (group) =>
      !state.case!.lockedGroups.includes(group.id) &&
      group.slots.every((slot) => Boolean(state.case!.slots[slot.id]))
  );
  return fullGroup ? { type: 'submitGroup', groupId: fullGroup.id } : null;
}

export const randomBot: Bot = (state, _actions, random) => {
  if (state.runStatus !== 'playing') return null;
  const options = supportActions(state, random);
  options.push(...currentInteractions(state));
  const graph = state.case ? buildCase(state.runSeed) : null;
  if (graph) {
    const board = randomBoardAction(state, graph, random);
    if (board) options.push(board);
  }
  const move = pickMove(state, random);
  if (move) options.push(move);
  return options[randomIndex(random, options.length)] || null;
};

export const caseBot: Bot = (state, _actions, random) => {
  if (state.runStatus !== 'playing' || !state.case) return null;
  const graph = buildCase(state.runSeed);

  const recipe = graph.recipes.find(
    (candidate) =>
      !state.case!.usedRecipes.includes(candidate.id) &&
      candidate.pair.every((cardId) => state.case!.cards.includes(cardId))
  );
  if (recipe) return { type: 'combine', a: recipe.pair[0], b: recipe.pair[1] };

  const answerSlot = graph.slots.find((slot) => {
    if (state.case!.lockedGroups.includes(slot.groupId)) return false;
    if (!state.case!.cards.includes(slot.answer) || state.case!.slots[slot.id] === slot.answer) {
      return false;
    }
    return true;
  });
  if (answerSlot) return { type: 'placeCard', slotId: answerSlot.id, cardId: answerSlot.answer };

  const correctGroup = graph.groups.find(
    (group) =>
      !state.case!.lockedGroups.includes(group.id) &&
      group.slots.every((slot) => state.case!.slots[slot.id] === slot.answer)
  );
  if (correctGroup) return { type: 'submitGroup', groupId: correctGroup.id };

  const needed = neededCaseCards(state, graph);
  const itemRooms = requiredItemRoomsForNeededCards(state, graph, needed);
  const collectible = state.currentRoomId
    ? state.visitedRooms[state.currentRoomId]?.collectible_item
    : undefined;
  if (
    collectible &&
    itemRooms.includes(state.currentRoomId!) &&
    !state.inventory.some((item) => item.id === collectible.id)
  ) {
    return { type: 'collect', itemId: collectible.id };
  }
  const look = currentCaseEvidence(state, graph, 'look', needed);
  if (look) return look;
  const check = currentCaseEvidence(state, graph, 'check', needed);
  if (check) return check;

  const skill = nextSkillPoint(state);
  if (skill) return { type: 'spendPoint', skill };

  const lockedCount = state.case.lockedGroups.length;
  if (itemRooms.length) return nextStepTo(state, itemRooms) || fallbackMove(state, random);
  const evidenceRooms = evidenceRoomsForNeededCards(state, graph, needed);
  if (state.currentRoomId === '100-1' && hasCloseCondition(state)) {
    return isInteractionAvailable(state, '100-1-finale')
      ? { type: 'interact', interactionId: '100-1-finale' }
      : fallbackMove(state, random);
  }
  if (hasCloseCondition(state) && state.currentRoomId !== '100-1') {
    return nextStepTo(state, ['100-1']) || fallbackMove(state, random);
  }
  if (evidenceRooms.length) return nextStepTo(state, evidenceRooms) || fallbackMove(state, random);
  if (lockedCount >= 2) {
    if (state.currentRoomId === '100-1' && state.minutesPastEight < 180) {
      return (
        getReachableRooms(state.currentRoomId, { hundredthUnlocked: true }).walk.has('0-5')
          ? { type: 'move', roomId: '0-5' }
          : fallbackMove(state, random)
      );
    }
    if (state.currentRoomId !== '100-1') {
      return nextStepTo(state, ['100-1']) || fallbackMove(state, random);
    }
  }
  return fallbackMove(state, random);
};

function roomsWithCombineAction(actions: Action[]): Set<string> {
  let roomId = '0-5';
  const rooms = new Set<string>();
  actions.forEach((action) => {
    if (action.type === 'startRun') roomId = '0-5';
    if (action.type === 'move') roomId = action.roomId;
    if (action.type === 'combine' && CASE_ROOM_IDS.includes(roomId as (typeof CASE_ROOM_IDS)[number])) {
      rooms.add(roomId);
    }
  });
  return rooms;
}

function randomCombineForRoom(
  state: PlayerState,
  actions: Action[],
  random: () => number
): Action | null {
  const roomId = state.currentRoomId;
  if (
    !state.case ||
    !roomId ||
    !CASE_ROOM_IDS.includes(roomId as (typeof CASE_ROOM_IDS)[number]) ||
    roomsWithCombineAction(actions).has(roomId)
  ) {
    return null;
  }
  const owned = state.case.cards;
  if (owned.length < 2) return null;
  const pairs: [string, string][] = [];
  for (let i = 0; i < owned.length; i += 1) {
    for (let j = i + 1; j < owned.length; j += 1) {
      const a = owned[i];
      const b = owned[j];
      if (isCombineAvailable(state, a, b)) pairs.push([a, b]);
    }
  }
  if (!pairs.length) return null;
  const [a, b] = pairs[randomIndex(random, pairs.length)];
  return { type: 'combine', a, b };
}

function randomGuessBoardAction(
  state: PlayerState,
  graph: CaseGraph,
  actions: Action[],
  random: () => number
): Action | null {
  if (!state.case) return null;
  for (const group of graph.groups) {
    if (state.case.lockedGroups.includes(group.id)) continue;
    const full = group.slots.every((slot) => Boolean(state.case!.slots[slot.id]));
    if (!full) {
      const slot = group.slots.find((candidate) => !state.case!.slots[candidate.id]);
      if (!slot) continue;
      const occupied = new Set(Object.values(state.case.slots).filter((id): id is string => Boolean(id)));
      const candidates = state.case.cards.filter((cardId) => {
        const card = graph.cards.find((candidate) => candidate.id === cardId);
        return Boolean(card && slot.accepts.includes(card.kind) && !occupied.has(cardId));
      });
      if (candidates.length) {
        return {
          type: 'placeCard',
          slotId: slot.id,
          cardId: candidates[randomIndex(random, candidates.length)],
        };
      }
      continue;
    }
    if (!actions.some((action) => action.type === 'submitGroup' && action.groupId === group.id)) {
      return { type: 'submitGroup', groupId: group.id };
    }
  }
  return null;
}

export const guessBot: Bot = (state, actions, random) => {
  if (state.runStatus !== 'playing' || !state.case) return null;
  const graph = buildCase(state.runSeed);
  const look = currentCaseEvidence(state, graph, 'look');
  if (look) return look;
  const check = currentCaseEvidence(state, graph, 'check');
  if (check) return check;
  const combine = randomCombineForRoom(state, actions, random);
  if (combine) return combine;
  const board = randomGuessBoardAction(state, graph, actions, random);
  if (board) return board;
  const skill = nextSkillPoint(state);
  if (skill) return { type: 'spendPoint', skill };

  const lockedCount = state.case.lockedGroups.length;
  if (state.currentRoomId === '100-1' && hasCloseCondition(state)) {
    return isInteractionAvailable(state, '100-1-finale')
      ? { type: 'interact', interactionId: '100-1-finale' }
      : fallbackMove(state, random);
  }
  if (hasCloseCondition(state) && state.currentRoomId !== '100-1') {
    return nextStepTo(state, ['100-1']) || fallbackMove(state, random);
  }
  const evidenceRooms = roomsWithAvailableEvidence(state, { checkMorale: true });
  if (evidenceRooms.length) return nextStepTo(state, evidenceRooms) || fallbackMove(state, random);
  if (lockedCount >= 2) {
    if (state.currentRoomId === '100-1' && state.minutesPastEight < 180) {
      return (
        getReachableRooms(state.currentRoomId, { hundredthUnlocked: true }).walk.has('0-5')
          ? { type: 'move', roomId: '0-5' }
          : fallbackMove(state, random)
      );
    }
    if (state.currentRoomId !== '100-1') {
      return nextStepTo(state, ['100-1']) || fallbackMove(state, random);
    }
  }
  return fallbackMove(state, random);
};

export interface BotRunResult {
  status: RunStatus;
  trapped: boolean;
  rooms: number;
  checks: number;
  minutes: number;
  grade: number | null;
  lockedGroups: number;
  wrongSubmissions: number;
  maxKnightChain: number;
  ponderUses: number;
  actions: Action[];
  finalState: PlayerState;
}

export function runBot(bot: Bot, seed: number, archetypeIdx: number): BotRunResult {
  const archetype = ARCHETYPES[archetypeIdx] || ARCHETYPES[0];
  const skills = DEFAULT_SKILLS();
  Object.entries(archetype.bonuses).forEach(([skill, bonus]) => {
    skills[skill as SkillId] += bonus || 0;
  });
  const character: Character = {
    name: 'bot',
    archetype: archetype.name,
    skills,
    signatureThought: archetype.signatureThought,
  };
  const random = mulberry32(seed * 7 + 1);
  const actions: Action[] = [];
  let state: PlayerState = INITIAL_PLAYER_STATE;
  let trapped = false;
  let maxKnightChain = 0;
  let ponderUses = 0;

  const applyAction = (action: Action): ReturnType<typeof step>['events'] => {
    actions.push(action);
    const result = step(state, action);
    state = result.state;
    result.events.forEach((event) => {
      if (event.type === 'moved') maxKnightChain = Math.max(maxKnightChain, event.chain);
      if (event.type === 'pondered') ponderUses += 1;
    });
    if (result.events.some((event) => event.type === 'rejected')) {
      trapped = true;
      return result.events;
    }
    result.events.forEach((event) => {
      if (event.type !== 'needsRoomContent') return;
      const room = BUILDING_LAYOUT.find((candidate) => candidate.id === event.roomId);
      if (!room || state.visitedRooms[event.roomId]) return;
      const content = fallbackRoom(
        room.id,
        room.name,
        state.runSeed,
        state.character,
        state.lastMoveKind === 'knight'
      );
      applyAction({ type: 'roomContent', roomId: room.id, content });
    });
    return result.events;
  };

  applyAction({
    type: 'startRun',
    character,
    seed,
    bible: caseBible(buildCase(seed)),
  });

  let steps = 0;
  while (state.runStatus === 'playing' && steps < 2000) {
    const action = bot(state, actions, random);
    if (!action) {
      trapped = true;
      break;
    }
    const events = applyAction(action);
    if (events.some((event) => event.type === 'rejected')) break;
    steps += 1;
  }
  if (state.runStatus === 'playing' && steps >= 2000) trapped = true;

  return {
    status: state.runStatus,
    trapped,
    rooms: state.roomsVisitedCount,
    checks: state.checkLog.length,
    minutes: state.minutesPastEight,
    grade: state.case?.grade ?? null,
    lockedGroups: state.case?.lockedGroups.length ?? 0,
    wrongSubmissions: state.case?.wrongSubmissions ?? 0,
    maxKnightChain,
    ponderUses,
    actions,
    finalState: state,
  };
}
