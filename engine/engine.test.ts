import { DEFAULT_SKILLS } from '../constants/skills';
import { Character, NarrativeResponse } from '../types';
import { getReachableRooms } from '../utils/gridLogic';
import { cacheRoom, INITIAL_PLAYER_STATE } from '../utils/gameLogic';
import {
  FALLBACK_BIBLE,
  FINALE_INTERACTION,
  fallbackRoom,
  sanitizeRoomContent,
} from '../utils/fallbackContent';
import { createSave, replay } from './save';
import { step } from './step';
import { Action } from './types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const character: Character = {
  name: 'Test',
  archetype: '棋手',
  skills: { ...DEFAULT_SKILLS(), constraint: 5 },
  signatureThought: 'test',
};

const startAction: Action = {
  type: 'startRun',
  character,
  seed: 42,
  bible: FALLBACK_BIBLE,
};

assert(getReachableRooms('100-1').walk.has('0-5'), 'the 100th floor must return to the hall');

const started = step(INITIAL_PLAYER_STATE, startAction).state;
assert(!started.discoveredFacts.includes(FALLBACK_BIBLE.investigator_hook), 'the hook is not a clue');
assert(started.discoveredFacts.length === 0, 'a run begins without discovered facts');

const roomContent: NarrativeResponse = {
  text: '房间停在二十点。',
  items: [],
  mood: '静滞',
  available_interactions: [
    {
      id: 'forged-ending',
      label: '查看',
      response: '你看了一眼。',
      type: 'check',
      skill: 'logic',
      difficulty: 'easy',
      kind: 'white',
      resolves_mystery: true,
      plot_flag: 'thread-test',
      clue: '检定成功的线索。',
      morale_on_success: 4,
      morale_on_fail: -8,
    },
  ],
  plot_updates: [{ thread_id: 'thread-test', clue: '房间里的传闻。' }],
};
const cached = cacheRoom(started, '0-5', roomContent);
const cachedThread = cached.plotThreads.find((thread) => thread.id === 'thread-test');
assert(cachedThread?.rumors.includes('房间里的传闻。'), 'entry plot updates become rumors');
assert(cachedThread?.status === 'rumored', 'entry plot updates reveal a rumor');
assert(cachedThread?.clues.length === 0, 'entry plot updates do not become clues');
assert(cached.discoveredFacts.length === 0, 'entry plot updates do not unlock rooms');
assert(
  cached.visitedRooms['0-5'].available_interactions?.[0].resolves_mystery === undefined,
  'room content cannot decide the ending'
);
assert(cached.visitedRooms['0-5'].available_interactions?.[0].morale_on_success === 1, 'success morale is clamped');
assert(cached.visitedRooms['0-5'].available_interactions?.[0].morale_on_fail === -1, 'failure morale is clamped');
let successfulForgery: ReturnType<typeof step> | null = null;
for (let seed = 1; seed < 500 && !successfulForgery; seed += 1) {
  const attempt = step(
    { ...cached, runSeed: seed },
    { type: 'interact', interactionId: 'forged-ending' }
  );
  if (attempt.events.some((event) => event.type === 'checkRolled' && event.result.success)) {
    successfulForgery = attempt;
  }
}
assert(successfulForgery, 'a deterministic successful content check should be found');
assert(
  successfulForgery.state.discoveredFacts.includes('检定成功的线索。'),
  'successful checks add their clue'
);
assert(successfulForgery.state.runStatus === 'playing', 'content cannot resolve the ending');

const ordinaryRedRoom = cacheRoom(started, '0-5', {
  ...roomContent,
  available_interactions: [
    {
      id: 'ordinary-red',
      label: '承担风险',
      response: '你承担了风险。',
      type: 'check',
      skill: 'logic',
      difficulty: 'easy',
      kind: 'red',
    },
  ],
});
let failedRed: ReturnType<typeof step> | null = null;
for (let seed = 1; seed < 500 && !failedRed; seed += 1) {
  const attempt = step(
    { ...ordinaryRedRoom, runSeed: seed },
    { type: 'interact', interactionId: 'ordinary-red' }
  );
  if (attempt.events.some((event) => event.type === 'checkRolled' && !event.result.success)) {
    failedRed = attempt;
  }
}
assert(failedRed, 'a deterministic failed red check should be found');
assert(
  step(failedRed.state, { type: 'interact', interactionId: 'ordinary-red' }).events[0]?.type ===
    'rejected',
  'ordinary red checks remain one-shot'
);

const canonicalRoom = sanitizeRoomContent('100-1', {
  ...roomContent,
  available_interactions: [roomContent.available_interactions![0], FINALE_INTERACTION],
});
const canonicalFinales = canonicalRoom.available_interactions?.filter(
  (interaction) => interaction.id === FINALE_INTERACTION.id
);
assert(canonicalFinales?.length === 1, 'room content replaces duplicate finale interactions');
assert(canonicalFinales[0].resolves_mystery === true, 'the canonical finale can resolve the mystery');
assert(
  canonicalFinales[0].skill === 'constraint' && canonicalFinales[0].difficulty === 'formidable',
  'the finale check retains its specified skill and difficulty'
);
assert(
  canonicalRoom.available_interactions?.every(
    (interaction) => interaction.id === FINALE_INTERACTION.id || !interaction.resolves_mystery
  ),
  'only the canonical finale retains the ending flag'
);

const blocked = step(started, { type: 'move', roomId: 'not-a-room' });
assert(blocked.events[0]?.type === 'rejected', 'blocked moves are rejected');
assert(JSON.stringify(blocked.state) === JSON.stringify(started), 'rejected moves do not mutate state');

const finaleContent = sanitizeRoomContent('100-1', {
  text: '终点。',
  items: [],
  mood: '静滞',
  available_interactions: [],
});
const finaleBase = {
  ...started,
  currentRoomId: '100-1',
  visitedRooms: { '100-1': finaleContent },
};
let failedFinale: ReturnType<typeof step> | null = null;
for (let seed = 1; seed < 500 && !failedFinale; seed += 1) {
  const attempt = step(
    { ...finaleBase, runSeed: seed },
    { type: 'interact', interactionId: FINALE_INTERACTION.id }
  );
  if (
    attempt.events.some((event) => event.type === 'checkRolled' && !event.result.success)
  ) {
    failedFinale = attempt;
  }
}
assert(failedFinale, 'a deterministic failing finale seed should be found');
assert(failedFinale.state.finaleFactsAtAttempt === 0, 'failed finale records the clue count');
const lockedRetry = step(failedFinale.state, {
  type: 'interact',
  interactionId: FINALE_INTERACTION.id,
});
assert(lockedRetry.events[0]?.type === 'rejected', 'the finale stays locked without new facts');
const rearmed = step(
  { ...failedFinale.state, discoveredFacts: ['a newly discovered fact'] },
  { type: 'interact', interactionId: FINALE_INTERACTION.id }
);
assert(
  rearmed.events.some((event) => event.type === 'checkRolled'),
  'a new fact re-arms the finale'
);
let solvedFinale: ReturnType<typeof step> | null = null;
for (let seed = 1; seed < 500 && !solvedFinale; seed += 1) {
  const attempt = step(
    { ...finaleBase, runSeed: seed },
    { type: 'interact', interactionId: FINALE_INTERACTION.id }
  );
  if (attempt.events.some((event) => event.type === 'runEnded' && event.status === 'solved')) {
    solvedFinale = attempt;
  }
}
assert(solvedFinale?.state.runStatus === 'solved', 'only a successful canonical finale solves the run');

const actions: Action[] = [
  startAction,
  {
    type: 'roomContent',
    roomId: '0-5',
    content: fallbackRoom('0-5', 'HALL', 42, character),
  },
  { type: 'move', roomId: [...getReachableRooms('0-5').all][0] },
];
const destination = (actions[2] as Extract<Action, { type: 'move' }>).roomId;
actions.push({
  type: 'roomContent',
  roomId: destination,
  content: fallbackRoom(destination, 'DESTINATION', 42, character),
});
const firstInteractable = actions[3] as Extract<Action, { type: 'roomContent' }>;
const interactionId = firstInteractable.content.available_interactions?.[0]?.id;
if (interactionId) actions.push({ type: 'interact', interactionId });

const liveState = actions.reduce((state, action) => step(state, action).state, INITIAL_PLAYER_STATE);
assert(
  JSON.stringify(replay(actions)) === JSON.stringify(liveState),
  'replaying a save reproduces the live state'
);
const deterministicReplayA = replay(actions);
const deterministicReplayB = replay(actions);
assert(
  JSON.stringify(deterministicReplayA) === JSON.stringify(deterministicReplayB),
  'identical action logs produce identical states'
);
assert(
  JSON.stringify(replay(createSave(actions).actions)) === JSON.stringify(liveState),
  'a version 4 save replays to the live state'
);

console.log('engine checks passed');
