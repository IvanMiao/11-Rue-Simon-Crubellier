import { DIFFICULTY_DC, SKILL_MAX } from '../constants/skills';
import { ARCHETYPES, DEFAULT_SKILLS, SKILL_ORDER } from '../constants/skills';
import { BUILDING_LAYOUT } from '../constants';
import { Character, Interaction, PlayerState, RunStatus, SkillId } from '../types';
import { getReachableRooms } from '../utils/gridLogic';
import {
  INITIAL_PLAYER_STATE,
  hundredthUnlocked,
  skillValue,
} from '../utils/gameLogic';
import { fallbackBibleForSeed, fallbackRoom, FINALE_INTERACTION } from '../utils/fallbackContent';
import { mulberry32 } from '../utils/rng';
import { Action } from './types';
import { step } from './step';

export type Bot = (state: PlayerState, actions: Action[], random: () => number) => Action | null;

function finaleReady(state: PlayerState): boolean {
  return (
    state.finaleFactsAtAttempt === undefined ||
    state.discoveredFacts.length > state.finaleFactsAtAttempt
  );
}

function availableChecks(state: PlayerState): Array<{ id: string; interaction: Interaction }> {
  const roomId = state.currentRoomId;
  const room = roomId ? state.visitedRooms[roomId] : undefined;
  if (!roomId || !room) return [];
  return (room.available_interactions || [])
    .map((interaction) => ({ id: interaction.id || interaction.label, interaction }))
    .filter(({ id, interaction }) => {
      if (!interaction.skill || !interaction.difficulty) return false;
      const key = `${roomId}::${id}`;
      if (state.resolvedChecks[key] === true) return false;
      if ((room.consumed_interaction_ids || []).includes(id)) return false;
      if (
        roomId === '100-1' &&
        id === FINALE_INTERACTION.id &&
        !finaleReady(state)
      ) {
        return false;
      }
      if (interaction.kind === 'red' && state.attemptedRedChecks.includes(key)) {
        const retryingFinale =
          roomId === '100-1' && id === FINALE_INTERACTION.id && finaleReady(state);
        if (!retryingFinale) return false;
      }
      const tries = state.checkLog.filter(
        (entry) => entry.roomId === roomId && entry.label === interaction.label
      ).length;
      if ((interaction.kind || 'white') === 'white' && tries >= 3) return false;
      if (state.morale <= 1 && id !== FINALE_INTERACTION.id) return false;
      return true;
    });
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
  return { type: 'move', roomId: candidates[Math.floor(random() * candidates.length)] };
}

function supportActions(state: PlayerState, random: () => number): Action[] {
  const actions: Action[] = [];
  const roomId = state.currentRoomId;
  const collectible = roomId ? state.visitedRooms[roomId]?.collectible_item : undefined;
  if (collectible && !state.inventory.some((item) => item.id === collectible.id)) {
    actions.push({ type: 'collect', itemId: collectible.id });
  }
  state.thoughts
    .filter((thought) => !thought.internalized)
    .forEach((thought) => actions.push({ type: 'internalize', thoughtId: thought.id }));
  if (state.pendingSkillPoints > 0 && state.character) {
    const skills = Object.keys(state.character.skills) as SkillId[];
    const availableSkills = skills.filter((id) => state.character!.skills[id] < SKILL_MAX);
    const skill = availableSkills[Math.floor(random() * availableSkills.length)];
    if (skill) actions.push({ type: 'spendPoint', skill });
  }
  return actions;
}

function pickBestCheck(state: PlayerState): Action | null {
  const candidates = availableChecks(state);
  if (candidates.length === 0) return null;
  const probability = ({ interaction }: { interaction: Interaction }) => {
    const totalNeeded =
      DIFFICULTY_DC[interaction.difficulty!] -
      skillValue(state, interaction.skill!);
    let successes = 0;
    for (let die1 = 1; die1 <= 6; die1 += 1) {
      for (let die2 = 1; die2 <= 6; die2 += 1) {
        if (die1 + die2 >= totalNeeded) successes += 1;
      }
    }
    return successes / 36;
  };
  candidates.sort((left, right) => probability(right) - probability(left));
  return {
    type: 'interact',
    interactionId: candidates[0].id,
  };
}

export const randomBot: Bot = (state, _actions, random) => {
  if (state.runStatus !== 'playing') return null;
  const options = supportActions(state, random);
  const check = pickBestCheck(state);
  if (check) options.push(check);
  const move = pickMove(state, random);
  if (move) options.push(move);
  return options[Math.floor(random() * options.length)] || null;
};

export const knightBot: Bot = (state, _actions, random) => {
  if (state.runStatus !== 'playing') return null;
  const roomId = state.currentRoomId;
  if (roomId === '100-1') {
    if (
      finaleReady(state) &&
      availableChecks(state).some(({ id }) => id === FINALE_INTERACTION.id)
    ) {
      return { type: 'interact', interactionId: FINALE_INTERACTION.id };
    }
    return pickMove(state, random, { preferUnvisited: true, preferKnight: true, excludeFinale: true });
  }
  const collectible = roomId ? state.visitedRooms[roomId]?.collectible_item : undefined;
  if (collectible && !state.inventory.some((item) => item.id === collectible.id)) {
    return { type: 'collect', itemId: collectible.id };
  }
  const check = pickBestCheck(state);
  if (check) return check;
  const thought = state.thoughts.find((candidate) => !candidate.internalized);
  if (thought) return { type: 'internalize', thoughtId: thought.id };
  if (state.pendingSkillPoints > 0 && state.character) {
    const skill =
      state.character.skills.constraint < SKILL_MAX
        ? 'constraint'
        : (Object.keys(state.character.skills) as SkillId[]).find(
            (id) => state.character!.skills[id] < SKILL_MAX
          );
    if (skill) return { type: 'spendPoint', skill };
  }
  if (hundredthUnlocked(state) && finaleReady(state)) {
    const reachable = getReachableRooms(roomId, { hundredthUnlocked: true });
    if (reachable.all.has('100-1')) return { type: 'move', roomId: '100-1' };
  }
  return pickMove(state, random, { preferUnvisited: true, preferKnight: true });
};

export const detectiveBot: Bot = (state, _actions, random) => {
  if (state.runStatus !== 'playing') return null;
  const roomId = state.currentRoomId;

  if (roomId === '100-1') {
    if (finaleReady(state)) {
      const finale = state.visitedRooms[roomId]?.available_interactions?.find(
        (interaction) => interaction.id === FINALE_INTERACTION.id
      );
      if (
        finale &&
        availableChecks(state).some(({ id }) => id === FINALE_INTERACTION.id)
      ) {
        return { type: 'interact', interactionId: FINALE_INTERACTION.id };
      }
    }
    return pickMove(state, random, { preferUnvisited: true, excludeFinale: true });
  }

  const support = supportActions(state, random);
  const collectible = support.find((action) => action.type === 'collect');
  if (collectible) return collectible;
  if (state.pendingSkillPoints > 0 && state.character) {
    const constraint = state.character.skills.constraint < SKILL_MAX ? 'constraint' : null;
    if (constraint) return { type: 'spendPoint', skill: constraint };
  }
  const thought = support.find((action) => action.type === 'internalize');
  if (thought) return thought;

  const check = pickBestCheck(state);
  if (check) return check;

  if (hundredthUnlocked(state) && finaleReady(state)) {
    const reachable = getReachableRooms(roomId, { hundredthUnlocked: true });
    if (reachable.all.has('100-1')) return { type: 'move', roomId: '100-1' };
  }

  return pickMove(state, random, { preferUnvisited: true });
};

export interface BotRunResult {
  status: RunStatus;
  trapped: boolean;
  rooms: number;
  checks: number;
  minutes: number;
  unlockAt: number | null;
  finaleAttempts: number;
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
  let unlockAt: number | null = null;

  const recordUnlock = () => {
    if (unlockAt === null && hundredthUnlocked(state)) unlockAt = state.minutesPastEight;
  };

  const applyAction = (action: Action) => {
    actions.push(action);
    const result = step(state, action);
    state = result.state;
    recordUnlock();
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

  applyAction({ type: 'startRun', character, seed, bible: fallbackBibleForSeed(seed) });

  let steps = 0;
  while (state.runStatus === 'playing' && steps < 2000) {
    const action = bot(state, actions, random);
    if (!action) {
      trapped = true;
      break;
    }
    const events = applyAction(action);
    if (events.some((event) => event.type === 'rejected')) {
      trapped = true;
      break;
    }
    steps += 1;
  }
  if (state.runStatus === 'playing' && steps >= 2000) trapped = true;

  return {
    status: state.runStatus,
    trapped,
    rooms: state.roomsVisitedCount,
    checks: state.checkLog.length,
    minutes: state.minutesPastEight,
    unlockAt,
    finaleAttempts: actions.filter(
      (action) =>
        action.type === 'interact' && action.interactionId === FINALE_INTERACTION.id
    ).length,
    actions,
    finalState: state,
  };
}
