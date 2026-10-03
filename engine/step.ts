import { SKILL_MAX, SKILL_ORDER, TIME_INTERACTION } from '../constants/skills';
import { BUILDING_LAYOUT } from '../constants';
import {
  appendJournal,
  applyCheckToState,
  applyTime,
  beginRun,
  cacheRoom,
  collectItem,
  consumeInteraction,
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

export function step(state: PlayerState, action: Action): { state: PlayerState; events: GameEvent[] } {
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
        const next = { ...beginRun(action.character, action.seed, action.bible), version: 4 };
        return { state: next, events: [{ type: 'needsRoomContent', roomId: '0-5' }] };
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
        const minutes = moveTimeCost(kind);
        const next: PlayerState = {
          ...applyTime(state, minutes),
          currentRoomId: action.roomId,
          lastMoveWasKnightMove: kind === 'knight',
          lastMoveWasWalk: kind === 'walk',
          lastMoveKind: kind,
        };
        const events: GameEvent[] = [
          { type: 'moved', from, to: action.roomId, kind, minutes },
        ];
        if (next.runStatus === 'playing' && !state.visitedRooms[action.roomId]) {
          events.push({ type: 'needsRoomContent', roomId: action.roomId });
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
        if ((room.consumed_interaction_ids || []).includes(action.interactionId)) {
          return reject(state, action, '这项互动已经结束。');
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
        const isFinale =
          roomId === '100-1' && action.interactionId === FINALE_INTERACTION.id;
        const finaleRearmed =
          isFinale &&
          (state.finaleFactsAtAttempt === undefined ||
            state.discoveredFacts.length > state.finaleFactsAtAttempt);
        if (state.morale <= 1 && !isFinale) {
          return reject(state, action, '意志太低，无法继续检定。');
        }
        if (state.resolvedChecks[key] === true) {
          return reject(state, action, '这项检定已经成功。');
        }
        if (
          interaction.kind === 'red' &&
          state.attemptedRedChecks.includes(key) &&
          !finaleRearmed
        ) {
          return reject(state, action, '红色检定只能尝试一次。');
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
            resolves_mystery: isFinale,
          }),
          roomId,
          `> ${result.success ? '成功' : '失败'} · ${interaction.label}\n${body}`
        );
        if (isFinale && !result.success) {
          const finaleRoom = next.visitedRooms[roomId];
          next = {
            ...next,
            finaleFactsAtAttempt: state.discoveredFacts.length,
            visitedRooms: {
              ...next.visitedRooms,
              [roomId]: {
                ...finaleRoom,
                consumed_interaction_ids: (finaleRoom.consumed_interaction_ids || []).filter(
                  (id) => id !== action.interactionId
                ),
              },
            },
          };
        }

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
      case 'internalize': {
        if (state.runStatus !== 'playing') return reject(state, action, '这一局已经结束。');
        const thought = state.thoughts.find((candidate) => candidate.id === action.thoughtId);
        if (!thought || thought.internalized) return reject(state, action, '这个念头无法内化。');
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
