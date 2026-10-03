import { DEFAULT_SKILLS, FINALE_MIN_GROUPS, TIME_COMBINE, TIME_INTERACTION, TIME_SUBMIT, WRONG_SUBMIT_MORALE } from '../constants/skills';
import { buildCase, caseBible, caseRoomContent, solveCase } from '../case/buildCase';
import type { CaseState, LiarId } from '../case/types';
import { Character } from '../types';
import { getReachableRooms } from '../utils/gridLogic';
import { INITIAL_PLAYER_STATE } from '../utils/gameLogic';
import { FINALE_INTERACTION, sanitizeRoomContent } from '../utils/fallbackContent';
import { createSave, replay } from './save';
import { caseBot, runBot } from './bots';
import { isCombineAvailable, isInteractionAvailable, step } from './step';
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

function makeRun(seed: number) {
  const graph = buildCase(seed);
  const startAction: Action = {
    type: 'startRun',
    character,
    seed,
    bible: caseBible(graph),
  };
  const result = step(INITIAL_PLAYER_STATE, startAction);
  return { graph, startAction, state: result.state, events: result.events };
}

function atRoom(state: ReturnType<typeof makeRun>['state'], roomId: string) {
  return {
    ...state,
    currentRoomId: roomId,
    visitedRooms: {
      ...state.visitedRooms,
      [roomId]: caseRoomContent(buildCase(state.runSeed), roomId),
    },
  };
}

function withCase(state: ReturnType<typeof makeRun>['state'], update: Partial<CaseState>) {
  return { ...state, case: { ...state.case!, ...update } };
}

assert(new Set(Array.from({ length: 100 }, (_, seed) => buildCase(seed).liar)).size === 3, 'seeds 0..99 cover every liar');
const seedByLiar = new Map<LiarId, number>();
for (let seed = 0; seed < 100; seed += 1) {
  const graph = buildCase(seed);
  assert(
    JSON.stringify(graph) === JSON.stringify(buildCase(seed)),
    `buildCase is deterministic for seed ${seed}`
  );
  if (!seedByLiar.has(graph.liar)) seedByLiar.set(graph.liar, seed);
}
assert(seedByLiar.size === 3, 'all liar variants have test seeds');
seedByLiar.forEach((seed) => {
  const result = solveCase(buildCase(seed));
  assert(result.solvable, `case with liar ${buildCase(seed).liar} is solvable: ${result.missing.join(', ')}`);
  const lookOnly = solveCase(buildCase(seed), { allowChecks: false });
  assert(
    lookOnly.solvable,
    `case with liar ${buildCase(seed).liar} is solvable from looks and recipes: ${lookOnly.missing.join(', ')}`
  );
});

const started = makeRun(42);
assert(started.events.length === 0, 'the authored hall is cached without requesting generated content');
assert(Boolean(started.state.visitedRooms['0-5']), 'a new run starts with the local hall content');
assert(started.state.version === 5, 'new runs use save version five');
assert(started.state.case?.liar === started.graph.liar, 'the seeded case is stored in the run state');
assert(started.state.discoveredFacts.length === 0, 'the case hook is not a clue');
assert(started.state.storyBible?.title === '第 439 幅', 'the case bible has the authored title');
assert(
  started.state.storyBible?.investigator_hook ===
    '一封没有署名的信：二十点整，巴特尔布思死在第 439 幅拼图前。午夜以前，把案卷补完。',
  'the case bible uses the exact hook'
);

const mailbox = step(started.state, { type: 'interact', interactionId: 'ev-hall-mailboxes' });
assert(mailbox.state.case?.cards.length === 6, 'the mailbox look grants its six person cards');
assert(mailbox.state.case?.takenEvidence.includes('ev-hall-mailboxes'), 'the mailbox look is consumed');
assert(mailbox.state.minutesPastEight === TIME_INTERACTION, 'a look costs five minutes');
assert(mailbox.state.case?.notes.length === 1, 'the look response is added to case notes');
assert(mailbox.events.some((event) => event.type === 'cardsFound'), 'card discovery emits cardsFound');
assert(!mailbox.events.some((event) => event.type === 'clueFound'), 'case cards are not narrative clues');
assert(!isInteractionAvailable(mailbox.state, 'ev-hall-mailboxes'), 'a consumed look is unavailable');

const failingHandCheck = (() => {
  for (let seed = 0; seed < 1000; seed += 1) {
    const run = makeRun(seed);
    const state = atRoom(run.state, '3-1');
    const attempt = step(state, { type: 'interact', interactionId: 'ev-bb-hand' });
    const check = attempt.events.find((event) => event.type === 'checkRolled');
    if (check?.type === 'checkRolled' && !check.result.success) {
      return { seed, attempt, state };
    }
  }
  return null;
})();
assert(failingHandCheck, 'a deterministic failed white hand check is available');
assert(
  failingHandCheck.attempt.state.case?.cards.includes('shape-v'),
  'a failed white check grants its authored failure card'
);
assert(
  failingHandCheck.attempt.state.case?.retryMarks['ev-bb-hand'] ===
    failingHandCheck.attempt.state.case.cards.length,
  'the white retry threshold is set after failure cards are added'
);
assert(
  !isInteractionAvailable(failingHandCheck.attempt.state, 'ev-bb-hand'),
  'failure cards alone do not immediately enable a white-check retry'
);
const newCard = step(failingHandCheck.attempt.state, { type: 'interact', interactionId: 'ev-bb-puzzle' });
assert(
  newCard.state.case!.cards.length > newCard.state.case!.retryMarks['ev-bb-hand'],
  'a later look grants a new card beyond the retry threshold'
);
assert(
  isInteractionAvailable(newCard.state, 'ev-bb-hand'),
  'a white check becomes available after a new card is owned'
);
assert(
  step(newCard.state, { type: 'interact', interactionId: 'ev-bb-hand' }).events.some(
    (event) => event.type === 'checkRolled'
  ),
  'an eligible white check can be retried'
);

const redRun = makeRun(117);
const redState = atRoom(redRun.state, '6-3');
const redAttempt = step(redState, { type: 'interact', interactionId: 'ev-wk-chair' });
assert(redAttempt.events.some((event) => event.type === 'checkRolled'), 'the red check is attempted');
assert(!isInteractionAvailable(redAttempt.state, 'ev-wk-chair'), 'the red check cannot be attempted twice');
assert(
  step(redAttempt.state, { type: 'interact', interactionId: 'ev-wk-chair' }).events[0]?.type ===
    'rejected',
  'a second red-check attempt is rejected'
);

const recipeRun = makeRun(59);
const recipeState = withCase(recipeRun.state, {
  cards: ['o-cut-notes', 'shape-x'],
});
assert(
  isCombineAvailable(recipeState, 'o-cut-notes', 'shape-x'),
  'an unused recipe pair is available to combine'
);
const ledgerRecipe = step(recipeState, { type: 'combine', a: 'o-cut-notes', b: 'shape-x' });
assert(ledgerRecipe.state.case?.cards.includes('o-ledger-439'), 'a valid recipe grants its output card');
assert(ledgerRecipe.state.case?.cards.includes('shape-w'), 'the ledger recipe grants the missing W card');
assert(ledgerRecipe.state.case?.usedRecipes.includes('rc-ledger'), 'a valid recipe is marked used');
assert(ledgerRecipe.state.minutesPastEight === TIME_COMBINE, 'combining costs ten minutes');
const duplicateRecipe = step(ledgerRecipe.state, { type: 'combine', a: 'o-cut-notes', b: 'shape-x' });
assert(
  !isCombineAvailable(ledgerRecipe.state, 'o-cut-notes', 'shape-x'),
  'a used recipe pair is unavailable to combine'
);
assert(
  duplicateRecipe.events[0]?.type === 'rejected' ||
    duplicateRecipe.state.case?.cards.filter((id) => id === 'o-ledger-439').length === 1,
  'a used recipe cannot grant duplicate outputs'
);
const wrongPairState = withCase(recipeRun.state, {
  cards: ['shape-x', 'o-blank-sheet'],
});
assert(
  isCombineAvailable(wrongPairState, 'shape-x', 'o-blank-sheet'),
  'an unused incorrect pair is still an accepted no-op combine'
);
const wrongPair = step(wrongPairState, { type: 'combine', a: 'shape-x', b: 'o-blank-sheet' });
assert(wrongPair.state.minutesPastEight === TIME_COMBINE, 'an invalid pair still costs ten minutes');
assert(wrongPair.state.case?.cards.length === 2, 'an invalid pair grants no card');
assert(
  wrongPair.events.some((event) => event.type === 'combined' && event.recipeId === null),
  'an invalid pair emits an empty combination event'
);

const alibiLiars = [...seedByLiar.entries()];
for (const [liar, seed] of alibiLiars) {
  const graph = buildCase(seed);
  const recipe = graph.recipes.find((candidate) => candidate.id === 'rc-alibi');
  assert(recipe, `${liar} has exactly one alibi recipe`);
  assert(graph.recipes.filter((candidate) => candidate.id === 'rc-alibi').length === 1, 'only one alibi recipe is present');
  const run = makeRun(seed);
  const owned = withCase(run.state, { cards: [...recipe.pair] });
  const valid = step(owned, { type: 'combine', a: recipe.pair[0], b: recipe.pair[1] });
  assert(valid.state.case?.cards.includes(recipe.cards[0]), `${liar}'s alibi recipe works`);

  const otherLiar = alibiLiars.find(([candidate]) => candidate !== liar)!;
  const otherPair = buildCase(otherLiar[1]).recipes.find((candidate) => candidate.id === 'rc-alibi')!.pair;
  const invalid = step(withCase(run.state, { cards: [...otherPair] }), {
    type: 'combine',
    a: otherPair[0],
    b: otherPair[1],
  });
  assert(
    !invalid.state.case?.cards.includes(graph.slots.find((slot) => slot.id === 'B2')!.answer),
    `${liar} cannot use another liar's alibi`
  );
}

const placementRun = makeRun(71);
assert(
  step(placementRun.state, { type: 'placeCard', slotId: 'A1', cardId: 'shape-x' }).events[0]?.type ===
    'rejected',
  'placing an unowned card is rejected'
);
const wrongKindState = withCase(placementRun.state, { cards: ['p-bartlebooth'] });
assert(
  step(wrongKindState, { type: 'placeCard', slotId: 'A1', cardId: 'p-bartlebooth' }).events[0]
    ?.type === 'rejected',
  'placing a card of the wrong kind is rejected'
);
const lockedState = withCase(placementRun.state, {
  cards: ['shape-x'],
  lockedGroups: ['A'],
});
assert(
  step(lockedState, { type: 'placeCard', slotId: 'A1', cardId: 'shape-x' }).events[0]?.type ===
    'rejected',
  'a locked group cannot be edited'
);

const groupRun = makeRun(73);
const wrongGroup = withCase(groupRun.state, {
  cards: ['shape-w', 'shape-x', 'p-winckler'],
  slots: { ...groupRun.state.case!.slots, A1: 'shape-w', A2: 'shape-x', A3: 'p-winckler' },
});
const wrongSubmission = step(wrongGroup, { type: 'submitGroup', groupId: 'A' });
assert(wrongSubmission.state.case?.wrongSubmissions === 1, 'a wrong group submission is counted');
assert(wrongSubmission.state.case?.lockedGroups.length === 0, 'a wrong group is not locked');
assert(wrongSubmission.state.morale === wrongGroup.morale + WRONG_SUBMIT_MORALE, 'a wrong submission costs one morale');
assert(wrongSubmission.state.minutesPastEight === TIME_SUBMIT, 'a group submission costs ten minutes');
assert(
  wrongSubmission.events.some((event) => event.type === 'groupRejected'),
  'a wrong group submission emits groupRejected'
);
const correctGroup = withCase(groupRun.state, {
  cards: ['shape-x', 'shape-w', 'p-winckler'],
  slots: { ...groupRun.state.case!.slots, A1: 'shape-x', A2: 'shape-w', A3: 'p-winckler' },
});
const lockedGroup = step(correctGroup, { type: 'submitGroup', groupId: 'A' });
assert(lockedGroup.state.case?.lockedGroups.includes('A'), 'a correct group is locked');
assert(lockedGroup.events.some((event) => event.type === 'groupLocked'), 'a correct group emits groupLocked');
assert(lockedGroup.state.case?.lockedGroups.length === 1, 'one group is not enough to unlock the finale');

assert(
  !getReachableRooms('0-5', { hundredthUnlocked: false }).all.has('100-1'),
  'the 100th floor is unreachable before two groups are locked'
);
assert(
  step(groupRun.state, { type: 'move', roomId: '100-1' }).events[0]?.type === 'rejected',
  'a move to the 100th floor is rejected before two groups are locked'
);
const lockedFinaleRoom = atRoom(groupRun.state, '100-1');
assert(
  step(lockedFinaleRoom, { type: 'interact', interactionId: FINALE_INTERACTION.id }).events[0]
    ?.type === 'rejected',
  'the finale is rejected with fewer than two locked groups'
);
assert(FINALE_MIN_GROUPS === 2, 'the finale requires at least two locked groups');

for (const count of [2, 3]) {
  const finaleState = withCase(atRoom(groupRun.state, '100-1'), {
    lockedGroups: ['A', 'B', 'C'].slice(0, count),
  });
  const finale = step(finaleState, { type: 'interact', interactionId: FINALE_INTERACTION.id });
  assert(finale.state.runStatus === 'solved', `the finale solves with ${count} locked groups`);
  assert(finale.state.case?.grade === count, `the finale records grade ${count}`);
  assert(
    finale.events.some((event) => event.type === 'runEnded' && event.status === 'solved'),
    'the finale emits a solved run-ended event'
  );
}

const canonical = sanitizeRoomContent('100-1', {
  text: '终点。',
  items: [],
  mood: '静滞',
  available_interactions: [
    {
      id: 'forged',
      label: '伪造结局',
      type: 'action',
      response: '伪造。',
      resolves_mystery: true,
    },
  ],
});
const finaleOnlyContent = caseRoomContent(buildCase(42), '100-1');
assert(
  finaleOnlyContent.available_interactions?.length === 1 &&
    finaleOnlyContent.available_interactions[0].id === FINALE_INTERACTION.id,
  'authored 100th-floor content exposes only the canonical finale'
);
const canonicalFinale = canonical.available_interactions?.find(
  (interaction) => interaction.id === FINALE_INTERACTION.id
);
assert(
  canonicalFinale?.type === 'action' &&
    canonical.available_interactions?.filter((interaction) => interaction.id === FINALE_INTERACTION.id).length ===
      1,
  'the canonical finale is injected exactly once'
);
assert(
  canonicalFinale?.label === '合上案卷' &&
    canonicalFinale.response === '你把案卷合上。',
  'the finale uses the authored action copy'
);
assert(
  canonical.available_interactions?.every(
    (interaction) => interaction.id === FINALE_INTERACTION.id || !interaction.resolves_mystery
  ),
  'sanitization strips ending authority from non-canonical interactions'
);

const blocked = step(started.state, { type: 'move', roomId: 'not-a-room' });
assert(blocked.events[0]?.type === 'rejected', 'blocked moves are rejected');
assert(JSON.stringify(blocked.state) === JSON.stringify(started.state), 'rejected moves do not mutate state');
assert(
  getReachableRooms('100-1').walk.has('0-5'),
  'the 100th floor has an exit back to the hall'
);

const save = createSave([started.startAction]);
assert(save.version === 5, 'action-log saves use version five');

const botRun = runBot(caseBot, 314159, 1);
const replayedBotRun = replay(botRun.actions);
assert(
  botRun.actions.some((action) => action.type === 'placeCard') &&
    botRun.actions.some((action) => action.type === 'combine') &&
    botRun.actions.some((action) => action.type === 'submitGroup'),
  'the caseBot replay sample includes board actions'
);
assert(
  JSON.stringify(replayedBotRun) === JSON.stringify(botRun.finalState),
  'replaying a caseBot action log with board actions reproduces the final state'
);
assert(
  JSON.stringify(replay(botRun.actions)) === JSON.stringify(replay(botRun.actions)),
  'replaying an identical caseBot action log is deterministic'
);

console.log('engine checks passed');
