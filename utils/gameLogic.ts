import {
  BASE_MORALE,
  MINUTES_PER_RUN,
  SKILL_MAX,
  SKILL_ORDER,
  TIME_ELEVATOR,
  TIME_INSPECT,
  TIME_INTERACTION,
  TIME_KNIGHT,
  TIME_THOUGHT,
  TIME_WALK,
  XP_PER_LEVEL,
} from '../constants/skills';
import {
  Character,
  CheckLogEntry,
  InventoryItem,
  NarrativeResponse,
  PlayerState,
  PlotThreadState,
  RunStatus,
  SkillCheckResult,
  SkillId,
  StoryBible,
  StoryPlotThread,
  Thought,
} from '../types';
import { upgradeRoomContent } from './roomRuntime';

export const INITIAL_PLAYER_STATE: PlayerState = {
  version: 3,
  runSeed: 0,
  runStatus: 'creating',
  minutesPastEight: 0,
  morale: BASE_MORALE,
  maxMorale: BASE_MORALE,
  currentRoomId: null,
  visitedRooms: {},
  resolvedChecks: {},
  attemptedRedChecks: [],
  inventory: [],
  puzzlePiecesCollected: 0,
  lastMoveWasKnightMove: false,
  lastMoveWasWalk: false,
  lastMoveKind: 'walk',
  plotThreads: [],
  thoughts: [],
  discoveredFacts: [],
  checkLog: [],
  xp: 0,
  pendingSkillPoints: 0,
  roomsVisitedCount: 0,
};

export function clockLabel(minutesPastEight: number): string {
  const total = 20 * 60 + minutesPastEight;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function moraleFromCharacter(character: Character): number {
  const will = Math.max(character.skills.constraint, character.skills.empathy);
  return BASE_MORALE + Math.floor(will / 3);
}

export function moveTimeCost(kind: 'walk' | 'knight' | 'elevator'): number {
  if (kind === 'knight') return TIME_KNIGHT;
  if (kind === 'elevator') return TIME_ELEVATOR;
  return TIME_WALK;
}

export function normalizePlotThreads(threads: StoryPlotThread[]): PlotThreadState[] {
  return threads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    summary: thread.summary,
    status: 'unknown' as const,
    clues: [],
  }));
}

export function thoughtsFromBible(bible: StoryBible): Thought[] {
  return (bible.thoughts || []).map((t) => ({
    ...t,
    internalized: false,
  }));
}

export function beginRun(
  character: Character,
  seed: number,
  bible: StoryBible
): PlayerState {
  const maxMorale = moraleFromCharacter(character);
  return {
    ...INITIAL_PLAYER_STATE,
    runStatus: 'playing',
    runSeed: seed,
    character,
    storyBible: bible,
    morale: maxMorale,
    maxMorale,
    currentRoomId: '0-5',
    plotThreads: normalizePlotThreads(bible.plot_threads || []),
    thoughts: thoughtsFromBible(bible),
    discoveredFacts: bible.investigator_hook ? [bible.investigator_hook] : [],
  };
}

export function applyTime(state: PlayerState, minutes: number): PlayerState {
  const minutesPastEight = state.minutesPastEight + minutes;
  if (state.runStatus !== 'playing') return { ...state, minutesPastEight };
  if (minutesPastEight >= MINUTES_PER_RUN) {
    return { ...state, minutesPastEight, runStatus: 'midnight' };
  }
  return { ...state, minutesPastEight };
}

export function applyMorale(state: PlayerState, delta: number): PlayerState {
  const morale = Math.max(0, Math.min(state.maxMorale, state.morale + delta));
  if (state.runStatus !== 'playing') return { ...state, morale };
  if (morale <= 0) return { ...state, morale, runStatus: 'collapsed' };
  return { ...state, morale };
}

export function grantXp(state: PlayerState, amount: number): PlayerState {
  let xp = state.xp + amount;
  let pendingSkillPoints = state.pendingSkillPoints;
  while (xp >= XP_PER_LEVEL) {
    xp -= XP_PER_LEVEL;
    pendingSkillPoints += 1;
  }
  return { ...state, xp, pendingSkillPoints };
}

export function skillBonusFromThoughts(state: PlayerState, skill: SkillId): number {
  return state.thoughts.filter((t) => t.internalized && t.skill === skill).length;
}

export function skillValue(state: PlayerState, skill: SkillId): number {
  const base = state.character?.skills[skill] ?? 1;
  return Math.min(SKILL_MAX, base + skillBonusFromThoughts(state, skill));
}

export function cacheRoom(state: PlayerState, roomId: string, content: NarrativeResponse): PlayerState {
  const previous = state.visitedRooms[roomId];
  const isNew = !previous;
  let next = {
    ...state,
    visitedRooms: {
      ...state.visitedRooms,
      [roomId]: content,
    },
    roomsVisitedCount: isNew ? state.roomsVisitedCount + 1 : state.roomsVisitedCount,
  };
  if (isNew) next = grantXp(next, 1);

  if (isNew && content.plot_updates?.length) {
    next = applyPlotUpdates(next, content.plot_updates);
  }
  if (isNew && content.offered_thought) {
    const exists = next.thoughts.some((t) => t.id === content.offered_thought!.id);
    if (!exists) {
      next = {
        ...next,
        thoughts: [...next.thoughts, { ...content.offered_thought, internalized: false }],
      };
    }
  }
  return next;
}

export function upgradeRoom(state: PlayerState, roomId: string, authored: NarrativeResponse): PlayerState {
  const previous = state.visitedRooms[roomId];
  const incoming: NarrativeResponse = { ...authored, source: 'authored' };
  if (!previous) return cacheRoom(state, roomId, incoming);

  const merged = upgradeRoomContent(previous, incoming);
  let next: PlayerState = {
    ...state,
    visitedRooms: {
      ...state.visitedRooms,
      [roomId]: merged,
    },
  };

  if (previous.source === 'skeleton') {
    if (merged.plot_updates?.length) {
      next = applyPlotUpdates(next, merged.plot_updates);
    }
    if (merged.offered_thought) {
      const exists = next.thoughts.some((t) => t.id === merged.offered_thought!.id);
      if (!exists) {
        next = {
          ...next,
          thoughts: [...next.thoughts, { ...merged.offered_thought, internalized: false }],
        };
      }
    }
  }
  return next;
}

export function applyPlotUpdates(
  state: PlayerState,
  updates: { thread_id: string; clue: string }[]
): PlayerState {
  let plotThreads = state.plotThreads.map((t) => ({ ...t, clues: [...t.clues] }));
  const discoveredFacts = [...state.discoveredFacts];

  updates.forEach((update) => {
    if (!update.clue) return;
    let thread = plotThreads.find((t) => t.id === update.thread_id);
    if (!thread) {
      thread = {
        id: update.thread_id,
        title: update.thread_id,
        summary: '',
        status: 'rumored',
        clues: [],
      };
      plotThreads = [...plotThreads, thread];
    }
    if (!thread.clues.includes(update.clue)) {
      thread.clues.push(update.clue);
      discoveredFacts.push(update.clue);
    }
    if (thread.status === 'unknown') thread.status = 'rumored';
    if (thread.clues.length >= 2 && thread.status !== 'resolved') thread.status = 'active';
    if (thread.clues.length >= 4) thread.status = 'resolved';
  });

  return { ...state, plotThreads, discoveredFacts };
}

export function collectItem(state: PlayerState, item: InventoryItem): PlayerState {
  if (state.inventory.some((i) => i.id === item.id)) return state;
  const isPuzzle = item.type === 'puzzle_piece';
  return {
    ...state,
    inventory: [...state.inventory, item],
    puzzlePiecesCollected: isPuzzle
      ? state.puzzlePiecesCollected + 1
      : state.puzzlePiecesCollected,
  };
}

export function appendJournal(state: PlayerState, roomId: string, entry: string): PlayerState {
  const room = state.visitedRooms[roomId];
  if (!room) return state;
  return {
    ...state,
    visitedRooms: {
      ...state.visitedRooms,
      [roomId]: {
        ...room,
        journal: [...(room.journal || []), entry],
      },
    },
  };
}

export function consumeInteraction(state: PlayerState, roomId: string, interactionId: string): PlayerState {
  const room = state.visitedRooms[roomId];
  if (!room) return state;
  const consumed = new Set(room.consumed_interaction_ids || []);
  consumed.add(interactionId);
  return {
    ...state,
    visitedRooms: {
      ...state.visitedRooms,
      [roomId]: {
        ...room,
        consumed_interaction_ids: Array.from(consumed),
      },
    },
  };
}

export function applyCheckToState(
  state: PlayerState,
  roomId: string,
  interactionId: string,
  label: string,
  result: SkillCheckResult,
  extras?: {
    clue?: string;
    plot_flag?: string;
    morale_on_success?: number;
    morale_on_fail?: number;
    resolves_mystery?: boolean;
  }
): PlayerState {
  const log: CheckLogEntry = {
    roomId,
    label,
    skill: result.skill,
    difficulty: result.difficulty,
    kind: result.kind,
    die1: result.die1,
    die2: result.die2,
    skillValue: result.skillValue,
    total: result.total,
    dc: result.dc,
    success: result.success,
    time: clockLabel(state.minutesPastEight),
  };

  let next: PlayerState = {
    ...state,
    checkLog: [...state.checkLog, log],
    resolvedChecks: {
      ...state.resolvedChecks,
      [`${roomId}::${interactionId}`]: result.success,
    },
    attemptedRedChecks:
      result.kind === 'red'
        ? [...state.attemptedRedChecks, `${roomId}::${interactionId}`]
        : state.attemptedRedChecks,
  };

  next = applyTime(next, TIME_INTERACTION);
  next = grantXp(next, result.success ? 2 : 1);

  const moraleDelta = result.success
    ? extras?.morale_on_success ?? 0
    : extras?.morale_on_fail ?? -1;
  if (moraleDelta) next = applyMorale(next, moraleDelta);

  if (result.success && extras?.clue) {
    next = applyPlotUpdates(next, [
      { thread_id: extras.plot_flag || 'mystery', clue: extras.clue },
    ]);
  }

  if (result.success && extras?.resolves_mystery) {
    next = { ...next, runStatus: 'solved' };
  }

  if (result.success || result.kind === 'red') {
    next = consumeInteraction(next, roomId, interactionId);
  }
  return next;
}

export function spendSkillPoint(state: PlayerState, skill: SkillId): PlayerState {
  if (!state.character || state.pendingSkillPoints <= 0) return state;
  const current = state.character.skills[skill];
  if (current >= SKILL_MAX) return state;
  return {
    ...state,
    pendingSkillPoints: state.pendingSkillPoints - 1,
    character: {
      ...state.character,
      skills: {
        ...state.character.skills,
        [skill]: current + 1,
      },
    },
  };
}

export function internalizeThought(state: PlayerState, thoughtId: string): PlayerState {
  const thought = state.thoughts.find((t) => t.id === thoughtId);
  if (!thought || thought.internalized) return state;
  let next = applyTime(state, TIME_THOUGHT);
  next = {
    ...next,
    thoughts: next.thoughts.map((t) =>
      t.id === thoughtId ? { ...t, internalized: true } : t
    ),
  };
  return next;
}

export function clueCount(state: PlayerState): number {
  return state.discoveredFacts.length;
}

export function hundredthUnlocked(state: PlayerState): boolean {
  return state.puzzlePiecesCollected >= 5 || clueCount(state) >= 4;
}

export function inspectCost(): number {
  return TIME_INSPECT;
}

export function highestSkills(character: Character, n = 3): SkillId[] {
  return [...SKILL_ORDER].sort((a, b) => character.skills[b] - character.skills[a]).slice(0, n);
}

export function endingTitle(status: RunStatus): string {
  switch (status) {
    case 'solved':
      return '第一百把钥匙';
    case 'midnight':
      return '午夜拆封';
    case 'collapsed':
      return '名录崩解';
    default:
      return '';
  }
}

export function endingBody(status: RunStatus): string {
  switch (status) {
    case 'solved':
      return '拼图合上了。不是因为缺的那一块被找到，而是因为你终于看清：缺本身就是画面。楼在二十点整的那一秒钟里，向你交出了它的用法。';
    case 'midnight':
      return '时间重新流动。电梯绳颤了一下，有人在上面的楼层放下电话。你还留在网格里，而六月二十三日结束了。';
    case 'collapsed':
      return '清单长过了你的神经。物件还在被列举，但列举者已经不在。你把自己写成了这栋楼的一条注脚。';
    default:
      return '';
  }
}
