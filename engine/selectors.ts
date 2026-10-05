import { DIFFICULTY_DC, TIME_INTERACTION } from '../constants/skills';
import { CASE_HOUR_PAGES, CASE_ITEMS, CASE_ROOM_IDS } from '../case/caseData';
import { buildCase } from '../case/buildCase';
import type { CardSource, CaseEvidence } from '../case/types';
import type { CheckKind, Interaction, PlayerState, SkillId } from '../types';
import { describeMove, getReachableRooms } from '../utils/gridLogic';
import { hundredthUnlocked, moveTimeCost, skillValue } from '../utils/gameLogic';
import { CELL_BY_ID, CLINAMEN_CELL, cellTitle } from '../world/damier';
import { FINALE_INTERACTION } from '../utils/fallbackContent';
import type { LockReason } from './types';
import {
  caseEvidenceAvailable,
  interactionLockReason as getInteractionLockReason,
  lineLockReason,
  lockReasonText,
} from './step';

export interface SheetLine {
  id: string;
  label: string;
  kind: 'look' | 'check' | 'item' | 'finale';
  status: 'open' | 'locked' | 'done' | 'failed';
  minutes: number;
  lock?: LockReason;
  check?: {
    skill: SkillId;
    skillValue: number;
    dc: number;
    chance: number;
    kind: CheckKind;
  };
  alternative?: { recipeId: string; cards: [string, string] };
  yielded: string[];
  faux?: boolean;
}

export interface RoomSheet {
  cellId: string;
  chapter: number | null;
  title: string;
  apartmentId: string;
  lines: SheetLine[];
  done: number;
  total: number;
  manque: boolean;
}

export type RoomSignal = 'lamp' | 'check' | 'changed' | 'locked';

function exactCheckChance(skill: number, dc: number): number {
  let successes = 0;
  for (let die1 = 1; die1 <= 6; die1 += 1) {
    for (let die2 = 1; die2 <= 6; die2 += 1) {
      if (die1 + die2 + skill >= dc) successes += 1;
    }
  }
  return successes / 36;
}

function caseCheckResult(state: PlayerState, evidence: CaseEvidence): boolean | undefined {
  return state.checkLog
    .slice()
    .reverse()
    .find((entry) => entry.roomId === evidence.roomId && entry.label === evidence.label)
    ?.success;
}

function yieldedCards(state: PlayerState, cellId: string, evidenceId: string): string[] {
  return Object.entries(state.case?.cardSources || {})
    .filter(
      ([, source]) => source.cellId === cellId && source.evidenceId === evidenceId
    )
    .map(([cardId]) => cardId);
}

function lineStatus(lock: LockReason | null, attemptedFailure = false): SheetLine['status'] {
  if (attemptedFailure) return 'failed';
  if (lock?.kind === 'done') return 'done';
  return lock ? 'locked' : 'open';
}

function evidenceSheetLine(state: PlayerState, evidence: CaseEvidence): SheetLine {
  const lock = lineLockReason(state, evidence.roomId, evidence.id) || undefined;
  const checkResult = evidence.kind === 'check' ? caseCheckResult(state, evidence) : undefined;
  const line: SheetLine = {
    id: evidence.id,
    label: evidence.label,
    kind: evidence.kind,
    status: lineStatus(lock || null, checkResult === false),
    minutes: TIME_INTERACTION,
    ...(lock ? { lock } : {}),
    yielded: yieldedCards(state, evidence.roomId, evidence.id),
  };
  if (
    evidence.kind === 'check' &&
    evidence.skill &&
    evidence.difficulty &&
    evidence.checkKind
  ) {
    const value = skillValue(state, evidence.skill);
    const dc = DIFFICULTY_DC[evidence.difficulty];
    line.check = {
      skill: evidence.skill,
      skillValue: value,
      dc,
      chance: exactCheckChance(value, dc),
      kind: evidence.checkKind,
    };
    const graph = buildCase(state.runSeed);
    const alternative = graph.recipes.find((recipe) =>
      evidence.cards.every((cardId) => recipe.cards.includes(cardId))
    );
    if (alternative) line.alternative = { recipeId: alternative.id, cards: alternative.pair };
  }
  const liarTestimony = `ts-${state.case?.liar.slice(2) || ''}`;
  if (
    state.case?.usedRecipes.includes('rc-alibi') &&
    evidence.cards.includes(liarTestimony)
  ) {
    line.faux = true;
  }
  return line;
}

function cachedInteractionLine(
  state: PlayerState,
  cellId: string,
  interaction: Interaction
): SheetLine {
  const id = interaction.id || interaction.label;
  const lock = lineLockReason(state, cellId, id) || undefined;
  const isCheck =
    interaction.type === 'check' || Boolean(interaction.skill && interaction.difficulty);
  const attempt = state.checkLog
    .slice()
    .reverse()
    .find((entry) => entry.roomId === cellId && entry.label === interaction.label);
  const line: SheetLine = {
    id,
    label: interaction.label,
    kind: isCheck ? 'check' : 'look',
    status: lineStatus(lock || null, isCheck && attempt?.success === false),
    minutes: TIME_INTERACTION,
    ...(lock ? { lock } : {}),
    yielded: yieldedCards(state, cellId, id),
  };
  if (isCheck && interaction.skill && interaction.difficulty) {
    const value = skillValue(state, interaction.skill);
    const dc = DIFFICULTY_DC[interaction.difficulty];
    line.check = {
      skill: interaction.skill,
      skillValue: value,
      dc,
      chance: exactCheckChance(value, dc),
      kind: interaction.kind || 'white',
    };
  }
  return line;
}

export function roomSignals(state: PlayerState): Record<string, RoomSignal[]> {
  if (!state.case || state.runStatus !== 'playing') {
    return Object.fromEntries(CASE_ROOM_IDS.map((roomId) => [roomId, []]));
  }
  const graph = buildCase(state.runSeed);
  return Object.fromEntries(
    CASE_ROOM_IDS.map((roomId) => {
      const evidence = graph.evidence.filter((candidate) => candidate.roomId === roomId);
      const available = (candidate: CaseEvidence) => caseEvidenceAvailable(state, candidate);
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
  return { kind, minutes: moveTimeCost(kind, state, state.currentRoomId, roomId) };
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
  if (state.runStatus !== 'playing' || !state.case || !state.case.notebook || state.morale < 2) return false;
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
): LockReason | null {
  return getInteractionLockReason(state, interactionId);
}

export { lockReasonText };

export function roomSheet(state: PlayerState, cellId: string): RoomSheet {
  const cell = CELL_BY_ID[cellId];
  const lines: SheetLine[] = [];
  if (cell && state.case) {
    const graph = buildCase(state.runSeed);
    graph.evidence
      .filter((evidence) => evidence.roomId === cellId)
      .forEach((evidence) => lines.push(evidenceSheetLine(state, evidence)));
  }

  const caseItem = CASE_ITEMS.find((item) => item.roomId === cellId);
  if (caseItem) {
    const collected = state.inventory.some((item) => item.id === caseItem.id);
    lines.push({
      id: caseItem.id,
      label: caseItem.name,
      kind: 'item',
      status: collected ? 'done' : 'open',
      minutes: 0,
      ...(collected ? { lock: { kind: 'done' } as const } : {}),
      yielded: [],
    });
  } else {
    const item = state.visitedRooms[cellId]?.collectible_item;
    if (item) {
      lines.push({
        id: item.id,
        label: item.name,
        kind: 'item',
        status: 'open',
        minutes: 0,
        yielded: [],
      });
    }
  }

  if (cellId === CLINAMEN_CELL) {
    const lock = lineLockReason(state, cellId, FINALE_INTERACTION.id) || undefined;
    const solved = state.runStatus === 'solved';
    lines.push({
      id: FINALE_INTERACTION.id,
      label: FINALE_INTERACTION.label,
      kind: 'finale',
      status: solved ? 'done' : lineStatus(lock || null),
      minutes: 0,
      ...(solved ? { lock: { kind: 'done' } as const } : lock ? { lock } : {}),
      yielded: [],
    });
  }

  const hasCaseLines =
    CASE_ROOM_IDS.includes(cellId as (typeof CASE_ROOM_IDS)[number]) ||
    Boolean(caseItem) ||
    cellId === CLINAMEN_CELL;
  if (!hasCaseLines) {
    state.visitedRooms[cellId]?.available_interactions?.forEach((interaction) => {
      lines.push(cachedInteractionLine(state, cellId, interaction));
    });
  }

  return {
    cellId,
    chapter: cell?.chapter ?? null,
    title: cell ? cellTitle(cellId) : cellId,
    apartmentId: cell?.apartmentId || '',
    lines,
    done: lines.filter((line) => line.status === 'done').length,
    total: lines.length,
    manque: cellId === '3:1',
  };
}

export function cardProvenance(
  state: PlayerState,
  cardId: string
): (CardSource & { chapter: number | null; title: string }) | null {
  const source = state.case?.cardSources[cardId];
  const cell = source ? CELL_BY_ID[source.cellId] : undefined;
  return source && cell
    ? { ...source, chapter: cell.chapter, title: cellTitle(cell.id) }
    : null;
}

export { roomsWithAvailableEvidence } from './step';
