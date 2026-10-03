import { CASE_HOUR_PAGES, CASE_ROOM_IDS } from '../case/caseData';
import { buildCase } from '../case/buildCase';
import type { CaseEvidence } from '../case/types';
import type { PlayerState } from '../types';
import { describeMove, getReachableRooms } from '../utils/gridLogic';
import { hundredthUnlocked, moveTimeCost } from '../utils/gameLogic';
import {
  caseEvidenceAvailable,
  interactionLockReason as getInteractionLockReason,
} from './step';

export type RoomSignal = 'lamp' | 'check' | 'changed' | 'locked';

export function roomSignals(state: PlayerState): Record<string, RoomSignal[]> {
  if (!state.case || state.runStatus !== 'playing') {
    return Object.fromEntries(CASE_ROOM_IDS.map((roomId) => [roomId, []]));
  }
  const graph = buildCase(state.runSeed);
  return Object.fromEntries(
    CASE_ROOM_IDS.map((roomId) => {
      const evidence = graph.evidence.filter((candidate) => candidate.roomId === roomId);
      const available = (candidate: CaseEvidence) =>
        caseEvidenceAvailable(state, candidate, { checkMorale: candidate.kind === 'check' });
      const signals: RoomSignal[] = [];
      if (evidence.some((candidate) => candidate.kind === 'look' && available(candidate))) {
        signals.push('lamp');
      }
      if (evidence.some((candidate) => candidate.kind === 'check' && available(candidate))) {
        signals.push('check');
      }
      if (
        evidence.some(
          (candidate) =>
            candidate.availableFrom !== undefined &&
            candidate.availableFrom <= state.minutesPastEight &&
            available(candidate)
        )
      ) {
        signals.push('changed');
      }
      if (
        evidence.some(
          (candidate) =>
            !state.case!.takenEvidence.includes(candidate.id) &&
            candidate.requiresItem !== undefined &&
            !state.inventory.some((item) => item.id === candidate.requiresItem)
        )
      ) {
        signals.push('locked');
      }
      return [roomId, signals];
    })
  );
}

export function moveCostTo(
  state: PlayerState,
  roomId: string
): { kind: 'walk' | 'knight' | 'elevator'; minutes: number } | null {
  if (state.runStatus !== 'playing' || !state.currentRoomId) return null;
  const reachable = getReachableRooms(state.currentRoomId, {
    hundredthUnlocked: hundredthUnlocked(state),
  });
  const kind = describeMove(reachable, roomId);
  if (kind === 'blocked') return null;
  return { kind, minutes: moveTimeCost(kind, state) };
}

export function nextHourPage(
  state: PlayerState
): { minute: number; hour: number; title: string } | null {
  if (state.runStatus !== 'playing') return null;
  const page = CASE_HOUR_PAGES.find((candidate) => candidate.minute > state.minutesPastEight);
  return page
    ? { minute: page.minute, hour: page.hour, title: page.title }
    : null;
}

export function isPonderAvailable(state: PlayerState, groupId: string): boolean {
  if (state.runStatus !== 'playing' || !state.case || state.morale < 2) return false;
  const group = buildCase(state.runSeed).groups.find((candidate) => candidate.id === groupId);
  if (
    !group ||
    state.case.lockedGroups.includes(group.id) ||
    group.slots.some((slot) => !state.case!.slots[slot.id])
  ) {
    return false;
  }
  const arrangement = group.slots.map((slot) => state.case!.slots[slot.id]).join(',');
  return !(state.case.pondered[group.id]?.split('\n').filter(Boolean) || []).includes(arrangement);
}

export function interactionLockReason(
  state: PlayerState,
  interactionId: string
): string | null {
  return getInteractionLockReason(state, interactionId);
}

export { roomsWithAvailableEvidence } from './step';
