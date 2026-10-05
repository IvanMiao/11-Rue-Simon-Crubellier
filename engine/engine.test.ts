import {
  DEFAULT_SKILLS,
  FINALE_MIN_GROUPS,
  THOUGHT_SLOTS,
  TIME_COMBINE,
  TIME_INTERACTION,
  TIME_SUBMIT,
  TIME_THOUGHT,
  TIME_WALK,
  WRONG_SUBMIT_MORALE,
} from '../constants/skills';
import { buildCase, caseBible, caseRoomContent, solveCase } from '../case/buildCase';
import { CASE_HOUR_PAGES, CASE_ITEMS, CASE_THOUGHTS } from '../case/caseData';
import type { CaseState, LiarId } from '../case/types';
import { Character } from '../types';
import { getReachableRooms } from '../utils/gridLogic';
import { INITIAL_PLAYER_STATE, skillValue } from '../utils/gameLogic';
import { FINALE_INTERACTION, sanitizeRoomContent } from '../utils/fallbackContent';
import { createSave, replay } from './save';
import { caseBot, runBot } from './bots';
import {
  caseEvidenceAvailable,
  isCombineAvailable,
  isInteractionAvailable,
  roomsWithAvailableEvidence,
  step,
} from './step';
import {
  interactionLockReason,
  isPonderAvailable,
  moveCostTo,
  nextHourPage,
  roomSheet,
  roomSignals,
  cardProvenance,
  lockReasonText,
} from './selectors';
import { Action } from './types';
import { CHAPTER_ONE_CELL, CLINAMEN_CELL } from '../world/damier';

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
  const notebook = step(result.state, { type: 'interact', interactionId: 'ev-stair-notebook' });
  return {
    graph,
    startAction,
    initialState: result.state,
    state: notebook.state,
    events: result.events,
  };
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

function withThoughtEffects(
  state: ReturnType<typeof makeRun>['state'],
  effects: string[]
) {
  return {
    ...state,
    thoughts: state.thoughts.map((thought) => ({
      ...thought,
      internalized: effects.includes(thought.id),
    })),
  };
}

function findKnightRoute(start: string, moves: number): string[] | null {
  const visit = (roomId: string, path: string[]): string[] | null => {
    if (path.length === moves + 1) return path;
    const reachable = getReachableRooms(roomId);
    for (const target of reachable.knight) {
      if (reachable.walk.has(target) || reachable.elevator.has(target)) continue;
      if (path.includes(target)) continue;
      const route = visit(target, [...path, target]);
      if (route) return route;
    }
    return null;
  };
  return visit(start, [start]);
}

function markVisited(state: ReturnType<typeof makeRun>['state'], roomId: string) {
  return {
    ...state,
    visitedRooms: {
      ...state.visitedRooms,
      [roomId]: state.visitedRooms[roomId] || { text: '', items: [], mood: '' },
    },
  };
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
const keySeed = seedByLiar.get('p-nochere')!;
const keyringIndex = CASE_ITEMS.findIndex((item) => item.id === 'it-keyring');
assert(keyringIndex >= 0, 'the keyring is authored as a case item');
const [removedKeyring] = CASE_ITEMS.splice(keyringIndex, 1);
try {
  assert(
    !solveCase(buildCase(keySeed), { allowChecks: false }).solvable,
    'the nocheré variant is unsolvable without its required keyring'
  );
} finally {
  if (removedKeyring) CASE_ITEMS.splice(keyringIndex, 0, removedKeyring);
}

const started = makeRun(42);
assert(started.events.length === 0, 'the authored chapter-one cell is cached without generated content');
assert(Boolean(started.initialState.visitedRooms['3:6']), 'a new run starts with chapter-one cell content');
assert(started.initialState.case?.notebook === false, 'a new run starts without the notebook');
assert(started.state.case?.notebook === true, 'the authored notebook look grants the case file');
assert(started.state.version === 7, 'new runs use save version seven');
const mailboxEvidence = started.graph.evidence.find((evidence) => evidence.id === 'ev-hall-mailboxes')!;
const noNotebookMailbox = step(atRoom(started.initialState, '0:6'), {
  type: 'interact',
  interactionId: mailboxEvidence.id,
});
assert(
  noNotebookMailbox.events[0]?.type === 'rejected' &&
    noNotebookMailbox.events[0].reason === '先拾起楼梯上的速写本。' &&
    noNotebookMailbox.events[0].lock?.kind === 'needsNotebook',
  'case evidence stays gated until the notebook is picked up'
);
const notebookLock = interactionLockReason(noNotebookMailbox.state, mailboxEvidence.id);
assert(
  notebookLock?.kind === 'needsNotebook' &&
    lockReasonText(notebookLock) === '先拾起楼梯上的速写本。',
  'the needsNotebook lock has its authored copy'
);
const noNotebookBoard = withCase(started.initialState, { cards: ['shape-x'] });
for (const action of [
  { type: 'combine', a: 'shape-x', b: 'shape-w' },
  { type: 'placeCard', slotId: 'A1', cardId: 'shape-x' },
  { type: 'submitGroup', groupId: 'A' },
  { type: 'ponder', groupId: 'A' },
] as Action[]) {
  const result = step(noNotebookBoard, action);
  assert(
    result.events[0]?.type === 'rejected' &&
      result.events[0].reason === '还没有速写本。' &&
      result.events[0].lock?.kind === 'needsNotebook',
    `${action.type} stays gated until the notebook is picked up`
  );
}
assert(
  roomSheet(started.state, CHAPTER_ONE_CELL).lines.some(
    (line) => line.id === 'ev-stair-notebook' && line.status === 'done'
  ),
  'the room sheet marks the collected notebook as done'
);
assert(started.state.knightChain === 0, 'a new run starts with no knight chain');
assert(started.state.case?.liar === started.graph.liar, 'the seeded case is stored in the run state');
assert(started.state.discoveredFacts.length === 0, 'the case hook is not a clue');
assert(started.state.storyBible?.title === '第 439 幅', 'the case bible has the authored title');
assert(
  JSON.stringify(started.state.storyBible?.thoughts) === JSON.stringify(CASE_THOUGHTS),
  'case runs use the authored case thoughts'
);
const handEvidence = started.graph.evidence.find((evidence) => evidence.id === 'ev-bb-hand')!;
const lowMoraleState = { ...atRoom(started.state, '3:1'), morale: 1 };
assert(
  roomsWithAvailableEvidence(started.state).includes('3:1'),
  'case rooms with available evidence are shared with map consumers'
);
assert(
  caseEvidenceAvailable(lowMoraleState, handEvidence),
  'map evidence availability ignores morale by default'
);
assert(
  !caseEvidenceAvailable(lowMoraleState, handEvidence, { checkMorale: true }),
  'bot evidence availability applies the morale gate when requested'
);
const moraleLock = interactionLockReason(lowMoraleState, handEvidence.id);
assert(
  moraleLock?.kind === 'lowMorale' &&
    lockReasonText(moraleLock) === '意志太低，无法继续检定。',
  'the lowMorale lock has its authored copy'
);
assert(roomSignals(started.state)['0:5'].includes('lamp'), 'available looks light their room');
assert(
  roomSignals(started.state)['-1:3'].includes('locked'),
  'rooms with missing required items show a locked signal'
);
assert(
  roomSignals(lowMoraleState)['3:1'].includes('check'),
  'map check signals ignore the morale gate'
);
const liftLock = interactionLockReason(started.state, 'ev-hall-lift');
assert(
  liftLock?.kind === 'notBefore' &&
    liftLock.minute === 60 &&
    lockReasonText(liftLock) === '还没到时候。21:00 以后再来。',
  'late evidence reports its typed authored lock reason independent of current location'
);
assert(
  lockReasonText({ kind: 'done' }) === '这一行已经记下了。' &&
    lockReasonText({ kind: 'needsNewCard' }) === '换个角度：先拿到一张新卡再试。' &&
    lockReasonText({ kind: 'needsGroups', have: 1, need: 2 }) ===
      '案卷至少要有 2 组对上（现在 1 组）。' &&
    lockReasonText({ kind: 'unavailable' }) === '找不到这项互动。',
  'all remaining lock kinds use their authored copy'
);
assert(
  interactionLockReason(started.state, 'not-an-interaction')?.kind === 'unavailable',
  'unknown interactions expose the unavailable lock'
);
assert(
  nextHourPage(started.state)?.minute === 60 &&
    nextHourPage(started.state)?.hour === 21 &&
    nextHourPage(started.state)?.title === CASE_HOUR_PAGES[0].title,
  'the next hour-page selector exposes the next page'
);
assert(
  started.state.storyBible?.investigator_hook ===
    '一封没有署名的信：二十点整，巴特尔布思死在第 439 幅拼图前。午夜以前，把案卷补完。',
  'the case bible uses the exact hook'
);

const mailbox = step(atRoom(started.state, '0:6'), {
  type: 'interact',
  interactionId: 'ev-hall-mailboxes',
});
assert(mailbox.state.case?.cards.length === 6, 'the mailbox look grants its six person cards');
assert(mailbox.state.case?.takenEvidence.includes('ev-hall-mailboxes'), 'the mailbox look is consumed');
assert(
  mailbox.state.minutesPastEight === started.state.minutesPastEight + TIME_INTERACTION,
  'a look costs five minutes'
);
assert(mailbox.state.case?.notes.length === 2, 'the look response is added to case notes');
assert(mailbox.events.some((event) => event.type === 'cardsFound'), 'card discovery emits cardsFound');
assert(!mailbox.events.some((event) => event.type === 'clueFound'), 'case cards are not narrative clues');
assert(!isInteractionAvailable(mailbox.state, 'ev-hall-mailboxes'), 'a consumed look is unavailable');
const doneLock = interactionLockReason(mailbox.state, 'ev-hall-mailboxes');
assert(
  doneLock?.kind === 'done' && lockReasonText(doneLock) === '这一行已经记下了。',
  'consumed evidence exposes the done lock'
);
const mailboxSource = cardProvenance(mailbox.state, 'p-bartlebooth');
assert(
  mailboxSource?.via === 'look' &&
    mailboxSource.cellId === '0:6' &&
    mailboxSource.evidenceId === 'ev-hall-mailboxes',
  'card provenance records the look route and authored cell'
);
const handSheetState = {
  ...atRoom(started.state, '3:1'),
  character: {
    ...started.state.character!,
    skills: { ...started.state.character!.skills, [started.graph.handSkill]: 4 },
  },
};
const handSheet = roomSheet(handSheetState, '3:1');
const handLine = handSheet.lines.find((line) => line.id === 'ev-bb-hand');
const mediumEvidence = started.graph.evidence.find(
  (evidence) => evidence.kind === 'check' && evidence.difficulty === 'medium'
)!;
const mediumSheetState = {
  ...atRoom(started.state, mediumEvidence.roomId),
  character: {
    ...started.state.character!,
    skills: { ...started.state.character!.skills, [mediumEvidence.skill!]: 4 },
  },
};
const mediumLine = roomSheet(mediumSheetState, mediumEvidence.roomId).lines.find(
  (line) => line.id === mediumEvidence.id
);
assert(
  mediumLine?.check?.skillValue === 4 &&
    mediumLine.check.dc === 10 &&
    mediumLine.check.chance === 26 / 36 &&
    handLine?.alternative?.recipeId === 'rc-ledger',
  'room sheets show exact 2d6 odds and recipe alternatives'
);
assert(
  handSheet.manque && !roomSheet(started.state, '3:6').manque,
  'manque is marked only for Bartlebooth cell 3:1'
);
const testimonyCard = `ts-${started.graph.liar.slice(2)}`;
const testimonyEvidence = started.graph.evidence.find((evidence) =>
  evidence.cards.includes(testimonyCard)
)!;
const testimonyRoomSheet = roomSheet(
  atRoom(started.state, testimonyEvidence.roomId),
  testimonyEvidence.roomId
);
const preRecipeTestimony = testimonyRoomSheet.lines.find(
  (line) => line.id === testimonyEvidence.id
);
const postRecipeTestimony = roomSheet(
  withCase(atRoom(started.state, testimonyEvidence.roomId), { usedRecipes: ['rc-alibi'] }),
  testimonyEvidence.roomId
).lines.find((line) => line.id === testimonyEvidence.id);
assert(!preRecipeTestimony?.faux && postRecipeTestimony?.faux, 'testimony is faux only after the alibi recipe');
assert(
  roomSheet(mailbox.state, '0:6').lines.some(
    (line) => line.id === 'ev-hall-mailboxes' && line.status === 'done' && line.yielded.length === 6
  ),
  'the room sheet reports completed evidence and cards yielded'
);

const crossingAt21 = step(
  { ...atRoom(started.state, '0:6'), minutesPastEight: 55 },
  { type: 'interact', interactionId: 'ev-hall-mailboxes' }
);
assert(
  crossingAt21.events.some(
    (event) =>
      event.type === 'hourTurned' &&
      event.minute === 60 &&
      event.hour === 21 &&
      event.title === CASE_HOUR_PAGES[0].title &&
      event.text === CASE_HOUR_PAGES[0].text
  ),
  'crossing 21:00 emits its authored hour page'
);
assert(
  crossingAt21.state.case?.notes.includes(CASE_HOUR_PAGES[0].text),
  'crossed hour-page text is appended to case notes'
);
assert(
  isInteractionAvailable(atRoom(crossingAt21.state, '0:7'), 'ev-hall-lift'),
  'hour pages do not remove evidence and late evidence becomes available'
);
assert(
  roomSignals(crossingAt21.state)['0:7'].includes('changed'),
  'rooms signal evidence whose authored availability time has arrived'
);
assert(
  nextHourPage(crossingAt21.state)?.minute === 120 &&
    nextHourPage(crossingAt21.state)?.hour === 22,
  'the hour-page selector advances after the first page'
);

const crossingAt22State = {
  ...withCase(started.state, { cards: ['shape-x', 'o-blank-sheet'] }),
  minutesPastEight: 115,
};
const crossingAt22 = step(crossingAt22State, {
  type: 'combine',
  a: 'shape-x',
  b: 'o-blank-sheet',
});
assert(
  crossingAt22.events.some(
    (event) =>
      event.type === 'hourTurned' &&
      event.minute === 120 &&
      event.text === CASE_HOUR_PAGES[1].text
  ),
  'crossing 22:00 emits the second hour page'
);
assert(
  nextHourPage({ ...crossingAt22.state, minutesPastEight: 180 }) === null,
  'there is no next hour page after 23:00'
);

const steamThoughts = withThoughtEffects(
  {
    ...withCase(started.state, { cards: ['shape-x', 'o-blank-sheet'] }),
    minutesPastEight: 175,
    morale: 2,
  },
  ['thought-steam']
);
const crossingAt23 = step(steamThoughts, {
  type: 'combine',
  a: 'shape-x',
  b: 'o-blank-sheet',
});
assert(
  crossingAt23.events.some(
    (event) =>
      event.type === 'hourTurned' &&
      event.minute === 180 &&
      event.title === CASE_HOUR_PAGES[2].title
  ),
  'crossing 23:00 emits the third hour page'
);
assert(crossingAt23.state.morale === 1, 'thought-steam costs one morale at an hour page');
const steamCollapse = step(
  { ...steamThoughts, morale: 1 },
  { type: 'combine', a: 'shape-x', b: 'o-blank-sheet' }
);
assert(
  steamCollapse.state.runStatus === 'collapsed' &&
    steamCollapse.events.some((event) => event.type === 'runEnded' && event.status === 'collapsed'),
  'an hour-page morale cost can collapse the run and emits runEnded'
);
const hallState = atRoom(started.state, '1:7');
const nonCaseWalkTarget = '1:8';
assert(
  moveCostTo(hallState, nonCaseWalkTarget)?.kind === 'walk',
  'the stairwell cell borders an ordinary apartment cell'
);
const roomContentEndingMove = step(
  withThoughtEffects(
    {
      ...hallState,
      minutesPastEight: 180 - TIME_WALK,
      morale: 1,
    },
    ['thought-steam']
  ),
  { type: 'move', roomId: nonCaseWalkTarget }
);
assert(
  roomContentEndingMove.state.runStatus === 'collapsed' &&
    !roomContentEndingMove.events.some((event) => event.type === 'needsRoomContent'),
  'hour-page collapse does not request new room content after the run ends'
);

const knightRoute = findKnightRoute(CHAPTER_ONE_CELL, 3);
assert(knightRoute, 'three consecutive knight moves are reachable from chapter one');
const darkState = { ...started.state, minutesPastEight: 180 };
const darkReachable = getReachableRooms(CHAPTER_ONE_CELL);
const darkWalkTarget = '3:5';
assert(darkReachable.walk.has(darkWalkTarget), '3:5 is an adjacent walking cell from chapter one');
const darkCost = moveCostTo(darkState, darkWalkTarget);
const darkMove = step(darkState, { type: 'move', roomId: darkWalkTarget });
assert(darkCost?.minutes === 20, 'walking from 23:00 costs twenty minutes');
assert(
  moveCostTo(darkState, knightRoute[1])?.minutes === 8,
  'the 23:00 penalty does not affect knight moves'
);
assert(
  darkMove.events.some((event) => event.type === 'moved' && event.minutes === darkCost?.minutes),
  'moveCostTo exactly matches the 23:00 walking cost'
);

const lateSeed = [...Array(100).keys()].find((seed) => buildCase(seed).liar === 'p-nochere')!;
const lateRun = makeRun(lateSeed);
const coalEvidence = lateRun.graph.evidence.find((evidence) => evidence.id === 'ev-ch-coal')!;
const lockedCoal = step(atRoom(lateRun.state, coalEvidence.roomId), {
  type: 'interact',
  interactionId: 'ev-ch-coal',
});
assert(
  lockedCoal.events[0]?.type === 'rejected' &&
    lockedCoal.events[0].reason === '锁着。需要诺谢尔太太的钥匙串。',
  'coal evidence is also locked before collecting the keyring'
);
const earlyLiftState = { ...atRoom(lateRun.state, '0:7'), minutesPastEight: 59 };
const earlyLift = step(earlyLiftState, { type: 'interact', interactionId: 'ev-hall-lift' });
assert(
  earlyLift.events[0]?.type === 'rejected' &&
    earlyLift.events[0].reason === '还没到时候。21:00 以后再来。' &&
    earlyLift.events[0].lock?.kind === 'notBefore',
  'the lift evidence is rejected before minute 60 with exact copy'
);
const lateLift = step(
  { ...atRoom(lateRun.state, '0:7'), minutesPastEight: 60 },
  { type: 'interact', interactionId: 'ev-hall-lift' }
);
assert(
  lateLift.events.some(
    (event) =>
      event.type === 'interacted' &&
      event.text === '铜指针停在 −1。有人坐它下过锅炉房。'
  ),
  'the lift evidence resolves the liar-specific text after minute 60'
);
const earlyHand = step(
  { ...atRoom(lateRun.state, '3:1'), minutesPastEight: 119 },
  { type: 'interact', interactionId: 'ev-bb-hand-late' }
);
assert(
  earlyHand.events[0]?.type === 'rejected' &&
    earlyHand.events[0].reason === '还没到时候。22:00 以后再来。',
  'the late hand evidence is rejected before minute 120'
);
const lateHand = step(
  { ...atRoom(lateRun.state, '3:1'), minutesPastEight: 120 },
  { type: 'interact', interactionId: 'ev-bb-hand-late' }
);
assert(
  lateHand.state.case?.cards.includes('shape-w') &&
    lateHand.events.some(
      (event) =>
        event.type === 'interacted' &&
        event.text === '一个小时过去，他的手指松开了一线。那一块的轮廓是 W。'
    ),
  'the late hand evidence grants W after minute 120'
);

const lockedReceiptState = atRoom(started.state, '0:3');
assert(
  interactionLockReason(lockedReceiptState, 'ev-an-receipt')?.kind === 'needsItem' &&
    lockReasonText(interactionLockReason(lockedReceiptState, 'ev-an-receipt')!) ===
      '锁着。需要诺谢尔太太的钥匙串。',
  'receipt evidence reports the missing-key lock reason'
);
const rejectedReceipt = step(lockedReceiptState, {
  type: 'interact',
  interactionId: 'ev-an-receipt',
});
assert(
  rejectedReceipt.events[0]?.type === 'rejected' &&
    rejectedReceipt.events[0].reason === '锁着。需要诺谢尔太太的钥匙串。' &&
    rejectedReceipt.events[0].lock?.kind === 'needsItem',
  'receipt evidence cannot be taken before collecting the keyring'
);
const keyRoom = atRoom(started.state, '0:5');
assert(
  keyRoom.visitedRooms['0:5'].collectible_item?.id === 'it-keyring',
  'the door-room exposes the keyring as a collectible item'
);
const keyCollected = step(keyRoom, { type: 'collect', itemId: 'it-keyring' });
assert(
  keyCollected.state.inventory.some((item) => item.id === 'it-keyring') &&
    keyCollected.state.minutesPastEight === keyRoom.minutesPastEight,
  'collecting the keyring uses the existing zero-time collect behavior'
);
assert(
  !roomSignals(keyCollected.state)['-1:3'].includes('locked'),
  'collecting the keyring clears the locked room signal'
);
assert(
  roomSheet(keyCollected.state, '0:5').lines.find((line) => line.id === 'it-keyring')?.status ===
    'done',
  'the room sheet marks a collected item as done'
);
const lateKeyCollection = step(atRoom(lateRun.state, '0:5'), {
  type: 'collect',
  itemId: 'it-keyring',
});
const coalAfterKey = step(
  atRoom(lateKeyCollection.state, coalEvidence.roomId),
  { type: 'interact', interactionId: 'ev-ch-coal' }
);
assert(
  coalAfterKey.state.case?.cards.includes('o-coal-glove'),
  'coal evidence is accepted after collecting the keyring'
);
const receipt = step(atRoom(keyCollected.state, '0:3'), {
  type: 'interact',
  interactionId: 'ev-an-receipt',
});
assert(
  receipt.state.case?.cards.includes('o-receipt'),
  'receipt evidence is accepted after collecting the keyring'
);

const loupeRoom = atRoom(started.state, '8:7');
assert(
  loupeRoom.visitedRooms['8:7'].collectible_item?.id === 'it-loupe',
  'the laboratory exposes the loupe as a collectible item'
);
const loupeCollected = step(loupeRoom, { type: 'collect', itemId: 'it-loupe' });
const perceptionSeed = [...Array(1000).keys()].find(
  (seed) => buildCase(seed).handSkill === 'perception'
)!;
const perceptionRun = makeRun(perceptionSeed);
const handCheckWithLoupe = step(
  {
    ...atRoom(perceptionRun.state, '3:1'),
    inventory: loupeCollected.state.inventory,
  },
  { type: 'interact', interactionId: 'ev-bb-hand' }
);
const loupeCheck = handCheckWithLoupe.events.find((event) => event.type === 'checkRolled');
const handCheckWithoutLoupe = step(atRoom(perceptionRun.state, '3:1'), {
  type: 'interact',
  interactionId: 'ev-bb-hand',
});
const baseHandCheck = handCheckWithoutLoupe.events.find((event) => event.type === 'checkRolled');
assert(
  loupeCheck?.type === 'checkRolled' &&
    baseHandCheck?.type === 'checkRolled' &&
    loupeCheck.result.skillValue === baseHandCheck.result.skillValue + 2 &&
    loupeCheck.result.skillValue ===
      skillValue({ ...atRoom(perceptionRun.state, '3:1'), inventory: loupeCollected.state.inventory }, 'perception'),
  'the loupe adds two to perception and reports the effective value in the check result'
);

let chainState = {
  ...started.state,
  morale: started.state.maxMorale - 1,
};
const expectedKnightCosts = [8, 6, 4];
for (let index = 0; index < expectedKnightCosts.length; index += 1) {
  const target = knightRoute[index + 1];
  const movement = step(chainState, { type: 'move', roomId: target });
  const moved = movement.events.find((event) => event.type === 'moved');
  assert(
    moved?.type === 'moved' &&
      moved.kind === 'knight' &&
      moved.minutes === expectedKnightCosts[index] &&
      moved.chain === index + 1,
    `knight chain move ${index + 1} costs ${expectedKnightCosts[index]} minutes`
  );
  if (index === 2) {
    assert(
      movement.events.some((event) => event.type === 'knightTour' && event.chain === 3),
      'each positive third knight move emits knightTour'
    );
  }
  chainState = markVisited(movement.state, target);
}
assert(
  chainState.knightChain === 3 &&
    chainState.morale === chainState.maxMorale &&
    chainState.case?.lockedGroups.length === 0,
  'every third knight move grants capped morale'
);
assert(
  step(chainState, { type: 'move', roomId: knightRoute[2] }).state.knightChain === 0,
  'a knight move into a visited room resets the chain'
);
const walkReachable = getReachableRooms(chainState.currentRoomId).walk;
const resetWalkTarget = [...walkReachable].find(
  (roomId) => !getReachableRooms(chainState.currentRoomId).knight.has(roomId)
)!;
const resetWalk = step(
  { ...chainState, knightChain: 2 },
  { type: 'move', roomId: resetWalkTarget }
);
assert(
  resetWalk.events.some((event) => event.type === 'moved' && event.kind === 'walk' && event.chain === 0),
  'walking resets the knight chain'
);
const elevatorTarget = '0:6';
const elevatorReset = step(
  {
    ...started.state,
    knightChain: 2,
  },
  { type: 'move', roomId: elevatorTarget }
);
assert(
  elevatorReset.events.some(
    (event) => event.type === 'moved' && event.kind === 'elevator' && event.chain === 0
  ),
  'elevator moves reset the knight chain'
);

const knightThoughtState = withThoughtEffects(started.state, ['thought-knight']);
const knightCost = moveCostTo(knightThoughtState, knightRoute[1]);
assert(knightCost?.kind === 'knight' && knightCost.minutes === 6, 'thought-knight reduces the first jump by two');
assert(
  moveCostTo({ ...knightThoughtState, knightChain: 2 }, knightRoute[1])?.minutes === 3,
  'thought-knight knight moves never cost less than three minutes'
);
const litWalkTarget = darkWalkTarget;
assert(
  moveCostTo(knightThoughtState, litWalkTarget)?.minutes === 20 &&
    moveCostTo({ ...knightThoughtState, minutesPastEight: 180 }, litWalkTarget)?.minutes === 25,
  'thought-knight adds five walking minutes and stacks with the 23:00 penalty'
);
assert(
  moveCostTo(started.state, 'not-a-room') === null,
  'moveCostTo returns null for a blocked move'
);

const failingHandCheck = (() => {
  for (let seed = 0; seed < 1000; seed += 1) {
    const run = makeRun(seed);
    const state = atRoom(run.state, '3:1');
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
const failureProvenance = cardProvenance(failingHandCheck.attempt.state, 'shape-v');
assert(
  failureProvenance?.via === 'checkFail' &&
    failureProvenance.cellId === '3:1' &&
    failureProvenance.evidenceId === 'ev-bb-hand',
  'failed-check cards retain their evidence provenance'
);
const failedHandLine = roomSheet(failingHandCheck.attempt.state, '3:1').lines.find(
  (line) => line.id === 'ev-bb-hand'
);
const retryLock = interactionLockReason(failingHandCheck.attempt.state, 'ev-bb-hand');
assert(
  failedHandLine?.status === 'failed' &&
    retryLock?.kind === 'needsNewCard' &&
    lockReasonText(retryLock) === '换个角度：先拿到一张新卡再试。',
  'a failed check remains visibly failed and waits for a new card'
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
const successfulHandCheck = (() => {
  for (let seed = 0; seed < 1000; seed += 1) {
    const run = makeRun(seed);
    const state = atRoom(run.state, '3:1');
    const attempt = step(state, { type: 'interact', interactionId: 'ev-bb-hand' });
    const check = attempt.events.find((event) => event.type === 'checkRolled');
    if (check?.type === 'checkRolled' && check.result.success) return { attempt };
  }
  return null;
})();
assert(successfulHandCheck, 'a deterministic successful white hand check is available');
const successProvenance = cardProvenance(successfulHandCheck.attempt.state, 'shape-w');
assert(
  successProvenance?.via === 'check' &&
    successProvenance.cellId === '3:1' &&
    successProvenance.evidenceId === 'ev-bb-hand',
  'successful-check cards retain their evidence provenance'
);

const redRun = makeRun(117);
const redState = atRoom(redRun.state, '6:10');
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
const recipeProvenance = cardProvenance(ledgerRecipe.state, 'o-ledger-439');
assert(
  recipeProvenance?.via === 'recipe' &&
    recipeProvenance.recipeId === 'rc-ledger' &&
    recipeProvenance.cellId === recipeState.currentRoomId,
  'recipe cards retain their route and recipe provenance'
);
const laterWLook = step(
  { ...atRoom(ledgerRecipe.state, '3:1'), minutesPastEight: 120 },
  { type: 'interact', interactionId: 'ev-bb-hand-late' }
);
assert(
  cardProvenance(laterWLook.state, 'shape-w')?.via === 'recipe',
  'later duplicate cards do not overwrite first-write provenance'
);
assert(
  ledgerRecipe.state.minutesPastEight === recipeState.minutesPastEight + TIME_COMBINE,
  'combining costs ten minutes'
);
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
assert(
  wrongPair.state.minutesPastEight === wrongPairState.minutesPastEight + TIME_COMBINE,
  'an invalid pair still costs ten minutes'
);
assert(wrongPair.state.case?.cards.length === 2, 'an invalid pair grants no card');
assert(
  wrongPair.events.some((event) => event.type === 'combined' && event.recipeId === null),
  'an invalid pair emits an empty combination event'
);
const catalogueCombineState = withThoughtEffects(
  withCase(recipeRun.state, { cards: ['o-cut-notes', 'shape-x'] }),
  ['thought-catalogue']
);
const catalogueCombine = step(catalogueCombineState, {
  type: 'combine',
  a: 'o-cut-notes',
  b: 'shape-x',
});
assert(
  catalogueCombine.state.minutesPastEight === catalogueCombineState.minutesPastEight + 5,
  'thought-catalogue reduces a combination to five minutes'
);

assert(THOUGHT_SLOTS === 2, 'two thought slots are available');
const internalizedThought = step(started.state, {
  type: 'internalize',
  thoughtId: 'thought-knight',
});
assert(
  internalizedThought.state.minutesPastEight === started.state.minutesPastEight + TIME_THOUGHT &&
    internalizedThought.state.thoughts.find((thought) => thought.id === 'thought-knight')
      ?.internalized,
  'internalizing a thought costs twenty minutes'
);
const cappedThoughtState = {
  ...started.state,
  thoughts: started.state.thoughts.map((thought, index) => ({
    ...thought,
    internalized: index < THOUGHT_SLOTS,
  })),
};
const thirdThought = step(cappedThoughtState, {
  type: 'internalize',
  thoughtId: 'thought-steam',
});
assert(
  thirdThought.events[0]?.type === 'rejected' &&
    thirdThought.events[0].reason === '念头只能住进两个。',
  'internalizing a third thought is rejected with exact copy'
);
const catalogueSkillState = withThoughtEffects(started.state, ['thought-catalogue']);
assert(
  skillValue(catalogueSkillState, 'logic') === started.state.character!.skills.logic,
  'case thoughts do not add the legacy skill point'
);
const steamCheckState = withThoughtEffects(atRoom(started.state, '6:10'), ['thought-steam']);
const steamCheck = step(steamCheckState, { type: 'interact', interactionId: 'ev-wk-chair' });
const steamCheckEvent = steamCheck.events.find((event) => event.type === 'checkRolled');
assert(
  steamCheckEvent?.type === 'checkRolled' &&
    steamCheckEvent.result.skillValue === skillValue(steamCheckState, 'inland') &&
    steamCheckEvent.result.skillValue ===
      steamCheckState.character!.skills.inland + 2,
  'thought-steam adds two to every check skill value'
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
const wrongSubmission = step({ ...wrongGroup, morale: 3 }, { type: 'submitGroup', groupId: 'A' });
assert(wrongSubmission.state.case?.wrongSubmissions === 1, 'a wrong group submission is counted');
assert(wrongSubmission.state.case?.lockedGroups.length === 0, 'a wrong group is not locked');
assert(wrongSubmission.state.morale === 3 + WRONG_SUBMIT_MORALE, 'a wrong submission costs one morale');
assert(
  wrongSubmission.state.minutesPastEight === groupRun.state.minutesPastEight + TIME_SUBMIT,
  'a group submission costs five minutes'
);
assert(
  wrongSubmission.events.some((event) => event.type === 'groupRejected'),
  'a wrong group submission emits groupRejected'
);
const correctGroup = withCase(groupRun.state, {
  cards: ['shape-x', 'shape-w', 'p-winckler'],
  slots: { ...groupRun.state.case!.slots, A1: 'shape-x', A2: 'shape-w', A3: 'p-winckler' },
});
const correctGroupLowMorale = { ...correctGroup, morale: correctGroup.maxMorale - 1 };
const lockedGroup = step(correctGroupLowMorale, { type: 'submitGroup', groupId: 'A' });
assert(lockedGroup.state.case?.lockedGroups.includes('A'), 'a correct group is locked');
assert(lockedGroup.events.some((event) => event.type === 'groupLocked'), 'a correct group emits groupLocked');
assert(lockedGroup.state.case?.lockedGroups.length === 1, 'one group is not enough to unlock the finale');
assert(
  lockedGroup.state.morale === lockedGroup.state.maxMorale,
  'correctly locking a group grants one capped morale'
);

const ponderGroup = groupRun.graph.groups.find((group) => group.id === 'A')!;
const ponderState = withCase(
  { ...groupRun.state, morale: groupRun.state.maxMorale },
  {
    cards: ['shape-v', 'shape-w', 'shape-x', 'p-winckler'],
    slots: {
      ...groupRun.state.case!.slots,
      A1: 'shape-v',
      A2: 'shape-w',
      A3: 'p-winckler',
    },
  }
);
assert(isPonderAvailable(ponderState, 'A'), 'a full unlocked group with enough morale can be pondered');
const ponder = step(ponderState, { type: 'ponder', groupId: 'A' });
assert(
  ponder.state.case?.pondered.A === 'shape-v,shape-w,p-winckler' &&
    ponder.state.morale === ponderState.morale - 1 &&
    ponder.state.minutesPastEight === ponderState.minutesPastEight,
  'ponder stores the arrangement, costs one morale and no time'
);
assert(
  ponder.events.some((event) => event.type === 'pondered' && event.groupId === 'A' && event.correct === 2) &&
    ponder.state.case?.notes.includes(`默念 ${ponderGroup.title}：三格里有 2 格是对的。`),
  'ponder reports the correct-slot count and appends its note'
);
assert(!isPonderAvailable(ponder.state, 'A'), 'a previously pondered arrangement is unavailable');
const repeatedPonder = step(ponder.state, { type: 'ponder', groupId: 'A' });
assert(
  repeatedPonder.events[0]?.type === 'rejected' &&
    repeatedPonder.events[0].reason === '同样的排法已经默念过了。',
  'repeating the same ponder arrangement is rejected'
);
const alternatePonderState = withCase(ponder.state, {
  pondered: ponder.state.case!.pondered,
  slots: { ...ponder.state.case!.slots, A1: 'shape-x' },
});
const alternatePonder = step(alternatePonderState, { type: 'ponder', groupId: 'A' });
assert(alternatePonder.events.some((event) => event.type === 'pondered'), 'a changed arrangement can be pondered');
const oldArrangement = withCase(alternatePonder.state, {
  slots: { ...alternatePonder.state.case!.slots, A1: 'shape-v' },
});
assert(
  step(oldArrangement, { type: 'ponder', groupId: 'A' }).events[0]?.type === 'rejected',
  'a previous arrangement remains unavailable after changing the slots'
);
assert(!isPonderAvailable(groupRun.state, 'A'), 'an incomplete group cannot be pondered');
const incompletePonder = step(groupRun.state, { type: 'ponder', groupId: 'A' });
assert(
  incompletePonder.events[0]?.type === 'rejected' &&
    incompletePonder.events[0].reason === '这一组还有空格。',
  'pondering an incomplete group is rejected with exact copy'
);
const lockedPonderState = withCase(ponderState, { lockedGroups: ['A'] });
const lockedPonder = step(lockedPonderState, { type: 'ponder', groupId: 'A' });
assert(
  lockedPonder.events[0]?.type === 'rejected' &&
    lockedPonder.events[0].reason === '这一组已经锁定。',
  'pondering a locked group is rejected with exact copy'
);
const lowMoralePonder = step(
  { ...ponderState, morale: 1 },
  { type: 'ponder', groupId: 'A' }
);
assert(
  lowMoralePonder.events[0]?.type === 'rejected' &&
    lowMoralePonder.events[0].reason === '意志不够了。',
  'pondering without enough morale is rejected with exact copy'
);

const catalogueWrongGroup = step(
  withThoughtEffects({ ...wrongGroup, morale: 3 }, ['thought-catalogue']),
  { type: 'submitGroup', groupId: 'A' }
);
assert(
  catalogueWrongGroup.state.morale === 1,
  'thought-catalogue makes an incorrect submission cost two morale'
);

assert(
  !getReachableRooms('-1:2', { hundredthUnlocked: false }).all.has(CLINAMEN_CELL),
  'the clinamen is unreachable before two groups are locked'
);
const clinamenApproach = {
  ...groupRun.state,
  currentRoomId: '-1:2',
  visitedRooms: {
    ...groupRun.state.visitedRooms,
    '-1:2': { text: '', items: [], mood: '' },
  },
};
assert(
  step(clinamenApproach, { type: 'move', roomId: CLINAMEN_CELL }).events[0]?.type === 'rejected',
  'a move into the clinamen is rejected before two groups are locked'
);
const unlockedClinamenMove = step(withCase(clinamenApproach, { lockedGroups: ['A', 'B'] }), {
  type: 'move',
  roomId: CLINAMEN_CELL,
});
assert(
  unlockedClinamenMove.events.some((event) => event.type === 'moved' && event.to === CLINAMEN_CELL),
  'the clinamen becomes walkable from -1:2 after two groups are locked'
);
const lockedFinaleRoom = atRoom(groupRun.state, CLINAMEN_CELL);
const finaleLine = roomSheet(lockedFinaleRoom, CLINAMEN_CELL).lines.find(
  (line) => line.id === FINALE_INTERACTION.id
);
const groupsLock = interactionLockReason(lockedFinaleRoom, FINALE_INTERACTION.id);
assert(
  finaleLine?.kind === 'finale' &&
    groupsLock?.kind === 'needsGroups' &&
    lockReasonText(groupsLock) === '案卷至少要有 2 组对上（现在 0 组）。',
  'the finale room sheet exposes its typed group lock'
);
assert(
  step(lockedFinaleRoom, { type: 'interact', interactionId: FINALE_INTERACTION.id }).events[0]
    ?.type === 'rejected',
  'the finale is rejected with fewer than two locked groups'
);
assert(FINALE_MIN_GROUPS === 2, 'the finale requires at least two locked groups');

for (const count of [2, 3]) {
  const finaleState = withCase(atRoom(groupRun.state, CLINAMEN_CELL), {
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

const canonical = sanitizeRoomContent(CLINAMEN_CELL, {
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
const finaleOnlyContent = caseRoomContent(buildCase(42), CLINAMEN_CELL);
assert(
  finaleOnlyContent.available_interactions?.length === 1 &&
    finaleOnlyContent.available_interactions[0].id === FINALE_INTERACTION.id,
  'authored clinamen content exposes only the canonical finale'
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
  getReachableRooms(CLINAMEN_CELL).walk.has('-1:2'),
  'the finale cell has an exit to the neighboring boiler-floor cell'
);

const save = createSave([started.startAction]);
assert(save.version === 7, 'action-log saves use version seven');

const botRun = runBot(caseBot, 314159, 1);
const replayedBotRun = replay(botRun.actions);
assert(
  botRun.actions[1]?.type === 'interact' &&
    botRun.actions[1].interactionId === 'ev-stair-notebook',
  'caseBot takes the notebook as its first action after starting'
);
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
