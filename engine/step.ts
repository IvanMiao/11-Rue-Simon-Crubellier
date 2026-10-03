import {
  FINALE_MIN_GROUPS,
  SKILL_MAX,
  SKILL_ORDER,
  THOUGHT_SLOTS,
  TIME_INTERACTION,
  TIME_SUBMIT,
  WRONG_SUBMIT_MORALE,
} from '../constants/skills';
import { BUILDING_LAYOUT } from '../constants';
import { CASE_HOUR_PAGES } from '../case/caseData';
import { CaseEvidence, CaseGraph, CaseState } from '../case/types';
import { buildCase, caseRoomContent, CASE_ROOM_IDS } from '../case/buildCase';
import {
  appendJournal,
  applyMorale,
  applyCheckToState,
  applyTime,
  beginRun,
  cacheRoom,
  combineTimeCost,
  collectItem,
  consumeInteraction,
  hasInternalizedThought,
  hundredthUnlocked,
  internalizeThought,
  moveTimeCost,
  skillValue,
  spendSkillPoint,
} from '../utils/gameLogic';
import { describeMove, getReachableRooms } from '../utils/gridLogic';
import { FINALE_INTERACTION } from '../utils/fallbackContent';
import { interactionKey, performSkillCheck } from '../utils/skillCheck';
import { Interaction, PlayerState, RunStatus } from '../types';
import { Action, GameEvent } from './types';

const reject = (state: PlayerState, action: Action, reason: string) => ({
  state,
  events: [{ type: 'rejected', action: action.type, reason } as const],
});

const endingEvent = (before: PlayerState, after: PlayerState): GameEvent[] =>
  before.runStatus === 'playing' && after.runStatus !== 'playing'
    ? [{ type: 'runEnded', status: after.runStatus }]
    : [];

const clampMorale = (value: number | undefined): number | undefined =>
  value === undefined || !Number.isFinite(value) ? undefined : Math.max(-1, Math.min(1, value));

function initialCaseState(graph: CaseGraph): CaseState {
  return {
    liar: graph.liar,
    handSkill: graph.handSkill,
    cards: [],
    takenEvidence: [],
    usedRecipes: [],
    slots: Object.fromEntries(graph.slots.map((slot) => [slot.id, null])),
    lockedGroups: [],
    wrongSubmissions: 0,
    retryMarks: {},
    pondered: {},
    notes: [],
  };
}

function addCards(caseState: CaseState, cardIds: string[]) {
  const known = new Set(caseState.cards);
  const cards = cardIds.filter((cardId) => {
    if (known.has(cardId)) return false;
    known.add(cardId);
    return true;
  });
  return { caseState: { ...caseState, cards: [...caseState.cards, ...cards] }, cards };
}

function caseEvidenceFor(state: PlayerState, interactionId: string): CaseEvidence | undefined {
  if (!state.case) return undefined;
  return buildCase(state.runSeed).evidence.find((evidence) => evidence.id === interactionId);
}

export function caseEvidenceAvailable(
  state: PlayerState,
  evidence: CaseEvidence,
  options: { checkMorale?: boolean } = {}
): boolean {
  if (
    state.runStatus !== 'playing' ||
    !state.case ||
    state.case.takenEvidence.includes(evidence.id)
  ) {
    return false;
  }
  if (evidence.availableFrom !== undefined && state.minutesPastEight < evidence.availableFrom) {
    return false;
  }
  if (
    evidence.requiresItem &&
    !state.inventory.some((item) => item.id === evidence.requiresItem)
  ) {
    return false;
  }
  if (options.checkMorale && evidence.kind === 'check' && state.morale <= 1) return false;
  if (evidence.kind === 'look') return true;
  const key = interactionKey(evidence.roomId, evidence.id);
  if (evidence.checkKind === 'red') return !state.attemptedRedChecks.includes(key);
  const retryMark = state.case.retryMarks[evidence.id];
  return retryMark === undefined || state.case.cards.length > retryMark;
}

export function roomsWithAvailableEvidence(
  state: PlayerState,
  options: { checkMorale?: boolean } = {}
): string[] {
  if (state.runStatus !== 'playing' || !state.case) return [];
  const graph = buildCase(state.runSeed);
  return [
    ...new Set(
      graph.evidence
        .filter((evidence) => caseEvidenceAvailable(state, evidence, options))
        .map((evidence) => evidence.roomId)
    ),
  ];
}

export function isInteractionAvailable(state: PlayerState, interactionId: string): boolean {
  if (state.runStatus !== 'playing' || !state.currentRoomId) return false;
  const roomId = state.currentRoomId;
  const room = state.visitedRooms[roomId];
  const interaction = room?.available_interactions?.find(
    (candidate) => (candidate.id || candidate.label) === interactionId
  );
  if (!interaction || (room?.consumed_interaction_ids || []).includes(interactionId)) return false;
  const isCheck =
    interaction.type === 'check' || Boolean(interaction.skill && interaction.difficulty);
  if (isCheck && state.morale <= 1) return false;

  if (roomId === '100-1' && interactionId === FINALE_INTERACTION.id) {
    return (state.case?.lockedGroups.length ?? 0) >= FINALE_MIN_GROUPS;
  }

  const evidence = caseEvidenceFor(state, interactionId);
  if (evidence) return caseEvidenceAvailable(state, evidence, { checkMorale: true });

  const key = interactionKey(roomId, interactionId);
  if (state.resolvedChecks[key] === true) return false;
  if (interaction.kind === 'red' && state.attemptedRedChecks.includes(key)) return false;
  return true;
}

export function interactionLockReason(state: PlayerState, interactionId: string): string | null {
  const roomId = state.currentRoomId;
  const room = roomId ? state.visitedRooms[roomId] : undefined;
  if (state.runStatus !== 'playing' || !roomId || !room) {
    return '当前房间还没有可互动的内容。';
  }
  const interaction = room.available_interactions?.find(
    (candidate) => (candidate.id || candidate.label) === interactionId
  );
  if (!interaction) return '找不到这项互动。';
  if ((room.consumed_interaction_ids || []).includes(interactionId)) {
    return '这项互动已经结束。';
  }
  if (roomId === '100-1' && interactionId === FINALE_INTERACTION.id) {
    return (state.case?.lockedGroups.length ?? 0) >= FINALE_MIN_GROUPS
      ? null
      : '案卷至少要有两组对上。';
  }

  const evidence = caseEvidenceFor(state, interactionId);
  if (evidence) {
    if (evidence.availableFrom !== undefined && state.minutesPastEight < evidence.availableFrom) {
      return '还没到时候。';
    }
    if (
      evidence.requiresItem &&
      !state.inventory.some((item) => item.id === evidence.requiresItem)
    ) {
      return '锁着。门房也许有钥匙。';
    }
    if (evidence.kind === 'check' && state.morale <= 1) {
      return '意志太低，无法继续检定。';
    }
    return caseEvidenceAvailable(state, evidence, { checkMorale: true })
      ? null
      : '这项互动已经结束。';
  }

  const isCheck =
    interaction.type === 'check' || Boolean(interaction.skill && interaction.difficulty);
  if (isCheck && state.morale <= 1) return '意志太低，无法继续检定。';
  const key = interactionKey(roomId, interactionId);
  if (
    state.resolvedChecks[key] === true ||
    (interaction.kind === 'red' && state.attemptedRedChecks.includes(key))
  ) {
    return '这项互动已经结束。';
  }
  return null;
}

export function isCombineAvailable(state: PlayerState, a: string, b: string): boolean {
  if (
    state.runStatus !== 'playing' ||
    !state.case ||
    a === b ||
    !state.case.cards.includes(a) ||
    !state.case.cards.includes(b)
  ) {
    return false;
  }
  const recipe = buildCase(state.runSeed).recipes.find(
    (candidate) =>
      (candidate.pair[0] === a && candidate.pair[1] === b) ||
      (candidate.pair[0] === b && candidate.pair[1] === a)
  );
  return !recipe || !state.case.usedRecipes.includes(recipe.id);
}

function stepAction(state: PlayerState, action: Action): { state: PlayerState; events: GameEvent[] } {
  try {
    switch (action.type) {
      case 'startRun': {
        if (
          state.runStatus !== 'creating' ||
          !Number.isFinite(action.seed) ||
          !action.character ||
          !action.character.skills ||
          !SKILL_ORDER.every((skill) => Number.isFinite(action.character.skills[skill])) ||
          !action.bible
        ) {
          return reject(state, action, '开局资料无效。');
        }
        const graph = buildCase(action.seed);
        let next: PlayerState = {
          ...beginRun(action.character, action.seed, action.bible),
          version: 6,
          case: initialCaseState(graph),
        };
        next = cacheRoom(next, '0-5', caseRoomContent(graph, '0-5'));
        return { state: next, events: [] };
      }
      case 'roomContent': {
        if (
          state.runStatus !== 'playing' ||
          !BUILDING_LAYOUT.some((room) => room.id === action.roomId) ||
          !action.content ||
          typeof action.content.text !== 'string'
        ) {
          return reject(state, action, '房间内容无效。');
        }
        return { state: cacheRoom(state, action.roomId, action.content), events: [] };
      }
      case 'move': {
        if (state.runStatus !== 'playing' || !state.currentRoomId) {
          return reject(state, action, '现在不能移动。');
        }
        const reachable = getReachableRooms(state.currentRoomId, {
          hundredthUnlocked: hundredthUnlocked(state),
        });
        const kind = describeMove(reachable, action.roomId);
        if (kind === 'blocked') return reject(state, action, '这个房间现在走不到。');
        const from = state.currentRoomId;
        const minutes = moveTimeCost(kind, state);
        const chain =
          kind === 'knight'
            ? state.visitedRooms[action.roomId]
              ? 0
              : state.knightChain + 1
            : 0;
        let next: PlayerState = {
          ...applyTime(state, minutes),
          currentRoomId: action.roomId,
          knightChain: chain,
          lastMoveWasKnightMove: kind === 'knight',
          lastMoveWasWalk: kind === 'walk',
          lastMoveKind: kind,
        };
        const events: GameEvent[] = [
          { type: 'moved', from, to: action.roomId, kind, minutes, chain },
        ];
        if (chain > 0 && chain % 3 === 0) {
          next = applyMorale(next, 1);
          events.push({ type: 'knightTour', chain });
        }
        if (next.runStatus === 'playing' && !state.visitedRooms[action.roomId]) {
          if (CASE_ROOM_IDS.includes(action.roomId as (typeof CASE_ROOM_IDS)[number]) || action.roomId === '100-1') {
            next = cacheRoom(next, action.roomId, caseRoomContent(buildCase(state.runSeed), action.roomId));
          } else {
            events.push({ type: 'needsRoomContent', roomId: action.roomId });
          }
        }
        events.push(...endingEvent(state, next));
        return { state: next, events };
      }
      case 'collect': {
        const roomId = state.currentRoomId;
        const item = roomId ? state.visitedRooms[roomId]?.collectible_item : undefined;
        if (state.runStatus !== 'playing' || !item || item.id !== action.itemId) {
          return reject(state, action, '这里没有这件物品。');
        }
        const collected = collectItem(state, item);
        const next: PlayerState = {
          ...collected,
          visitedRooms: {
            ...collected.visitedRooms,
            [roomId!]: { ...collected.visitedRooms[roomId!], collectible_item: undefined },
          },
        };
        return {
          state: next,
          events: [{ type: 'itemCollected', item }, ...endingEvent(state, next)],
        };
      }
      case 'interact': {
        const roomId = state.currentRoomId;
        const room = roomId ? state.visitedRooms[roomId] : undefined;
        if (state.runStatus !== 'playing' || !roomId || !room) {
          return reject(state, action, '当前房间还没有可互动的内容。');
        }
        const interaction = room.available_interactions?.find(
          (candidate) => (candidate.id || candidate.label) === action.interactionId
        );
        if (!interaction) return reject(state, action, '找不到这项互动。');
        const lockReason = interactionLockReason(state, action.interactionId);
        if (lockReason) {
          return reject(state, action, lockReason);
        }

        if (roomId === '100-1' && action.interactionId === FINALE_INTERACTION.id) {
          const caseState = state.case;
          if (!caseState || caseState.lockedGroups.length < FINALE_MIN_GROUPS) {
            return reject(state, action, '案卷至少要有两组对上。');
          }
          let next = appendJournal(
            state,
            roomId,
            `> ${interaction.label}\n${FINALE_INTERACTION.response}`
          );
          next = consumeInteraction(next, roomId, action.interactionId);
          next = {
            ...next,
            runStatus: 'solved',
            case: { ...caseState, grade: caseState.lockedGroups.length },
          };
          return {
            state: next,
            events: [
              {
                type: 'interacted',
                roomId,
                interactionId: action.interactionId,
                text: FINALE_INTERACTION.response,
              },
              ...endingEvent(state, next),
            ],
          };
        }

        const evidence = caseEvidenceFor(state, action.interactionId);
        if (evidence) {
          const caseState = state.case!;
          if (evidence.kind === 'look') {
            const response = evidence.text || interaction.response;
            let next = applyTime(state, TIME_INTERACTION);
            const added = addCards(caseState, evidence.cards);
            next = {
              ...next,
              case: {
                ...added.caseState,
                takenEvidence: [...caseState.takenEvidence, evidence.id],
                notes: [...caseState.notes, response],
              },
            };
            next = consumeInteraction(next, roomId, action.interactionId);
            next = appendJournal(next, roomId, `> ${interaction.label}\n${response}`);
            const events: GameEvent[] = [
              { type: 'interacted', roomId, interactionId: action.interactionId, text: response },
            ];
            if (added.cards.length) {
              events.push({ type: 'cardsFound', cards: added.cards, text: response });
            }
            events.push(...endingEvent(state, next));
            return { state: next, events };
          }
          if (!evidence.skill || !evidence.difficulty || !evidence.checkKind) {
            return reject(state, action, '这项检定缺少必要资料。');
          }
          if (state.morale <= 1) return reject(state, action, '意志太低，无法继续检定。');
          const key = interactionKey(roomId, action.interactionId);
          const result = performSkillCheck({
            skill: evidence.skill,
            skillValue: skillValue(state, evidence.skill),
            difficulty: evidence.difficulty,
            kind: evidence.checkKind,
            seed: state.runSeed,
            salt: `${key}:${state.checkLog.length}:${state.minutesPastEight}`,
          });
          const body = result.success
            ? evidence.successText || interaction.response
            : evidence.failureText || '什么也没有发生，只是你自己出了丑。';
          let next = applyCheckToState(state, roomId, action.interactionId, interaction.label, result, {
            morale_on_success: clampMorale(interaction.morale_on_success),
            morale_on_fail: clampMorale(interaction.morale_on_fail),
          });
          const cardsToGrant = result.success ? evidence.cards : evidence.failCards || [];
          const added = addCards(caseState, cardsToGrant);
          const taken =
            result.success || evidence.checkKind === 'red'
              ? [...caseState.takenEvidence, evidence.id]
              : caseState.takenEvidence;
          const retryMarks =
            !result.success && evidence.checkKind === 'white'
              ? { ...caseState.retryMarks, [evidence.id]: added.caseState.cards.length }
              : caseState.retryMarks;
          next = {
            ...next,
            case: {
              ...added.caseState,
              takenEvidence: taken,
              retryMarks,
              notes: [...caseState.notes, body],
            },
          };
          if (taken.includes(evidence.id)) {
            next = consumeInteraction(next, roomId, action.interactionId);
          }
          next = appendJournal(
            next,
            roomId,
            `> ${result.success ? '成功' : '失败'} · ${interaction.label}\n${body}`
          );
          const events: GameEvent[] = [
            {
              type: 'checkRolled',
              roomId,
              interactionId: action.interactionId,
              label: interaction.label,
              result,
              body,
            },
          ];
          if (added.cards.length) events.push({ type: 'cardsFound', cards: added.cards, text: body });
          events.push(...endingEvent(state, next));
          return { state: next, events };
        }

        const isCheck =
          interaction.type === 'check' || Boolean(interaction.skill && interaction.difficulty);
        if (isCheck && (!interaction.skill || !interaction.difficulty)) {
          return reject(state, action, '这项检定缺少必要资料。');
        }
        if (!isCheck) {
          const next = consumeInteraction(
            appendJournal(
              applyTime(state, TIME_INTERACTION),
              roomId,
              `> ${interaction.label}\n${interaction.response}`
            ),
            roomId,
            action.interactionId
          );
          return {
            state: next,
            events: [
              {
                type: 'interacted',
                roomId,
                interactionId: action.interactionId,
                text: interaction.response,
              },
              ...endingEvent(state, next),
            ],
          };
        }

        const key = interactionKey(roomId, action.interactionId);
        if (state.morale <= 1) {
          return reject(state, action, '意志太低，无法继续检定。');
        }

        const result = performSkillCheck({
          skill: interaction.skill!,
          skillValue: skillValue(state, interaction.skill!),
          difficulty: interaction.difficulty!,
          kind: interaction.kind,
          seed: state.runSeed,
          salt: `${key}:${state.checkLog.length}:${state.minutesPastEight}`,
        });
        const body = result.success
          ? interaction.success_response || interaction.response
          : interaction.failure_response || '什么也没有发生，只是你自己出了丑。';
        let next = appendJournal(
          applyCheckToState(state, roomId, action.interactionId, interaction.label, result, {
          clue: interaction.clue,
          plot_flag: interaction.plot_flag,
          morale_on_success: clampMorale(interaction.morale_on_success),
          morale_on_fail: clampMorale(interaction.morale_on_fail),
        }),
          roomId,
          `> ${result.success ? '成功' : '失败'} · ${interaction.label}\n${body}`
        );
        const events: GameEvent[] = [
          {
            type: 'checkRolled',
            roomId,
            interactionId: action.interactionId,
            label: interaction.label,
            result,
            body,
          },
        ];
        next.discoveredFacts.slice(state.discoveredFacts.length).forEach((clue) => {
          events.push({ type: 'clueFound', clue });
        });
        events.push(...endingEvent(state, next));
        return { state: next, events };
      }
      case 'placeCard': {
        if (state.runStatus !== 'playing' || !state.case) {
          return reject(state, action, '现在不能补写案卷。');
        }
        const graph = buildCase(state.runSeed);
        const slot = graph.slots.find((candidate) => candidate.id === action.slotId);
        if (!slot) return reject(state, action, '找不到这一格。');
        if (state.case.lockedGroups.includes(slot.groupId)) {
          return reject(state, action, '这一组已经锁定。');
        }
        const slots = { ...state.case.slots };
        if (action.cardId === null) {
          if (slots[slot.id] === null) return reject(state, action, '这一格已经空着。');
          slots[slot.id] = null;
          return { state: { ...state, case: { ...state.case, slots } }, events: [] };
        }
        if (!state.case.cards.includes(action.cardId)) {
          return reject(state, action, '这张词卡还没有找到。');
        }
        const card = graph.cards.find((candidate) => candidate.id === action.cardId);
        if (!card || !slot.accepts.includes(card.kind)) {
          return reject(state, action, '这张词卡放不进这一格。');
        }
        if (slots[slot.id] === action.cardId) return { state, events: [] };
        Object.keys(slots).forEach((slotId) => {
          if (slots[slotId] === action.cardId) slots[slotId] = null;
        });
        slots[slot.id] = action.cardId;
        return { state: { ...state, case: { ...state.case, slots } }, events: [] };
      }
      case 'combine': {
        if (state.runStatus !== 'playing' || !state.case) {
          return reject(state, action, '现在不能联想。');
        }
        if (
          action.a === action.b ||
          !state.case.cards.includes(action.a) ||
          !state.case.cards.includes(action.b)
        ) {
          return reject(state, action, '需要两张已经找到的不同词卡。');
        }
        const graph = buildCase(state.runSeed);
        const recipe = graph.recipes.find(
          (candidate) =>
            (candidate.pair[0] === action.a && candidate.pair[1] === action.b) ||
            (candidate.pair[0] === action.b && candidate.pair[1] === action.a)
        );
        if (recipe && state.case.usedRecipes.includes(recipe.id)) {
          return reject(state, action, '这两张词卡已经联想过了。');
        }
        if (!recipe) {
          const next = applyTime(state, combineTimeCost(state));
          return {
            state: next,
            events: [
              { type: 'combined', recipeId: null, text: '什么也没联想到。' },
              ...endingEvent(state, next),
            ],
          };
        }
        const added = addCards(state.case, recipe.cards);
        let next = applyTime(state, combineTimeCost(state));
        next = {
          ...next,
          case: {
            ...added.caseState,
            usedRecipes: [...state.case.usedRecipes, recipe.id],
            notes: [...state.case.notes, recipe.text],
          },
        };
        return {
          state: next,
          events: [
            { type: 'combined', recipeId: recipe.id, text: recipe.text },
            ...endingEvent(state, next),
          ],
        };
      }
      case 'submitGroup': {
        if (state.runStatus !== 'playing' || !state.case) {
          return reject(state, action, '现在不能对照案卷。');
        }
        const graph = buildCase(state.runSeed);
        const group = graph.groups.find((candidate) => candidate.id === action.groupId);
        if (!group) return reject(state, action, '找不到这一组。');
        if (state.case.lockedGroups.includes(group.id)) {
          return reject(state, action, '这一组已经锁定。');
        }
        if (group.slots.some((slot) => !state.case!.slots[slot.id])) {
          return reject(state, action, '这一组还有空格。');
        }
        const correct = group.slots.every(
          (slot) => state.case!.slots[slot.id] === slot.answer
        );
        let next = applyTime(state, TIME_SUBMIT);
        if (correct) {
          next = applyMorale(next, 1);
          next = {
            ...next,
            case: {
              ...state.case,
              lockedGroups: [...state.case.lockedGroups, group.id],
            },
          };
          return {
            state: next,
            events: [
              { type: 'groupLocked', groupId: group.id },
              ...endingEvent(state, next),
            ],
          };
        }
        next = applyMorale(
          next,
          hasInternalizedThought(state, 'catalogue')
            ? WRONG_SUBMIT_MORALE - 1
            : WRONG_SUBMIT_MORALE
        );
        next = {
          ...next,
          case: {
            ...state.case,
            wrongSubmissions: state.case.wrongSubmissions + 1,
          },
        };
        return {
          state: next,
          events: [
            { type: 'groupRejected', groupId: group.id },
            ...endingEvent(state, next),
          ],
        };
      }
      case 'ponder': {
        if (state.runStatus !== 'playing' || !state.case) {
          return reject(state, action, '现在不能默念案卷。');
        }
        const graph = buildCase(state.runSeed);
        const group = graph.groups.find((candidate) => candidate.id === action.groupId);
        if (!group) return reject(state, action, '找不到这一组。');
        if (state.case.lockedGroups.includes(group.id)) {
          return reject(state, action, '这一组已经锁定。');
        }
        if (group.slots.some((slot) => !state.case!.slots[slot.id])) {
          return reject(state, action, '这一组还有空格。');
        }
        if (state.morale < 2) return reject(state, action, '意志不够了。');
        const arrangement = group.slots.map((slot) => state.case!.slots[slot.id]).join(',');
        const previous = state.case.pondered[group.id]?.split('\n').filter(Boolean) || [];
        if (previous.includes(arrangement)) {
          return reject(state, action, '同样的排法已经默念过了。');
        }
        const correct = group.slots.filter(
          (slot) => state.case!.slots[slot.id] === slot.answer
        ).length;
        const next = applyMorale(state, -1);
        return {
          state: {
            ...next,
            case: {
              ...state.case,
              pondered: {
                ...state.case.pondered,
                [group.id]: [...previous, arrangement].join('\n'),
              },
              notes: [
                ...state.case.notes,
                `默念 ${group.title}：三格里有 ${correct} 格是对的。`,
              ],
            },
          },
          events: [
            { type: 'pondered', groupId: group.id, correct },
            ...endingEvent(state, next),
          ],
        };
      }
      case 'internalize': {
        if (state.runStatus !== 'playing') return reject(state, action, '这一局已经结束。');
        const thought = state.thoughts.find((candidate) => candidate.id === action.thoughtId);
        if (!thought || thought.internalized) return reject(state, action, '这个念头无法内化。');
        if (state.thoughts.filter((candidate) => candidate.internalized).length >= THOUGHT_SLOTS) {
          return reject(state, action, '念头只能住进两个。');
        }
        const next = internalizeThought(state, action.thoughtId);
        return {
          state: next,
          events: [
            { type: 'thoughtInternalized', thoughtId: action.thoughtId },
            ...endingEvent(state, next),
          ],
        };
      }
      case 'spendPoint': {
        if (
          state.runStatus !== 'playing' ||
          !state.character ||
          !SKILL_ORDER.includes(action.skill) ||
          !Number.isFinite(state.character.skills[action.skill]) ||
          state.pendingSkillPoints <= 0 ||
          state.character.skills[action.skill] >= SKILL_MAX
        ) {
          return reject(state, action, '没有可分配的技能点。');
        }
        return { state: spendSkillPoint(state, action.skill), events: [] };
      }
      default:
        return reject(state, action, '未知行动。');
    }
  } catch {
    return reject(state, action, '行动资料无效。');
  }
}

function applyHourPages(
  before: PlayerState,
  result: { state: PlayerState; events: GameEvent[] }
): { state: PlayerState; events: GameEvent[] } {
  if (
    before.runStatus !== 'playing' ||
    result.state.runStatus !== 'playing' ||
    result.state.minutesPastEight <= before.minutesPastEight
  ) {
    return result;
  }

  let next = result.state;
  const events = [...result.events];
  CASE_HOUR_PAGES.forEach((page) => {
    if (
      next.runStatus !== 'playing' ||
      before.minutesPastEight >= page.minute ||
      result.state.minutesPastEight < page.minute
    ) {
      return;
    }
    const pageStart = next;
    next = {
      ...next,
      case: next.case
        ? { ...next.case, notes: [...next.case.notes, page.text] }
        : next.case,
    };
    events.push({ type: 'hourTurned', ...page, roomIds: [...page.roomIds] });
    if (hasInternalizedThought(next, 'steam')) {
      next = applyMorale(next, -1);
      events.push(...endingEvent(pageStart, next));
    }
  });
  return {
    state: next,
    events:
      next.runStatus === 'playing'
        ? events
        : events.filter((event) => event.type !== 'needsRoomContent'),
  };
}

export function step(state: PlayerState, action: Action): { state: PlayerState; events: GameEvent[] } {
  return applyHourPages(state, stepAction(state, action));
}
