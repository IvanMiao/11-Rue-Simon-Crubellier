import type { SheetLine } from '../../engine/selectors';

export type MechanismKind = 'lift' | 'flip' | 'pry' | 'lean' | 'pickup' | 'generic';

export interface MechanismSpec {
  lineId: string;
  cellId: string;
  kind: MechanismKind;
  part: string;
  gesture: 'click' | 'drag';
  dragAxis?: 'up' | 'right' | 'left';
  hint: string;
}

export const MECHANISMS: Record<string, MechanismSpec> = {
  'ev-stair-notebook': {
    lineId: 'ev-stair-notebook',
    cellId: '3:6',
    kind: 'lift',
    part: 'stair-notebook',
    gesture: 'drag',
    dragAxis: 'up',
    hint: '拾起',
  },
  'ev-bb-puzzle': {
    lineId: 'ev-bb-puzzle',
    cellId: '3:1',
    kind: 'lean',
    part: 'bb-puzzle',
    gesture: 'click',
    hint: '俯看',
  },
  'ev-bb-hand': {
    lineId: 'ev-bb-hand',
    cellId: '3:1',
    kind: 'pry',
    part: 'bb-hand',
    gesture: 'drag',
    dragAxis: 'right',
    hint: '掰开',
  },
  'ev-bb-hand-late': {
    lineId: 'ev-bb-hand-late',
    cellId: '3:1',
    kind: 'pry',
    part: 'bb-hand',
    gesture: 'click',
    hint: '掰开',
  },
  'ev-wk-bench': {
    lineId: 'ev-wk-bench',
    cellId: '6:8',
    kind: 'flip',
    part: 'wk-notes',
    gesture: 'drag',
    dragAxis: 'left',
    hint: '翻开',
  },
  'it-keyring': {
    lineId: 'it-keyring',
    cellId: '0:5',
    kind: 'pickup',
    part: 'keyring',
    gesture: 'click',
    hint: '拾起',
  },
  'it-loupe': {
    lineId: 'it-loupe',
    cellId: '8:7',
    kind: 'pickup',
    part: 'loupe',
    gesture: 'click',
    hint: '拾起',
  },
};

export function mechanismFor(lineId: string, cellId: string): MechanismSpec {
  return MECHANISMS[lineId] ?? {
    lineId,
    cellId,
    kind: 'generic',
    part: '',
    gesture: 'click',
    hint: '查看',
  };
}

export function restPose(
  lineId: string,
  status: SheetLine['status'],
  hour: 20 | 21 | 22 | 23
): number {
  if (lineId === 'ev-bb-hand' && status === 'failed') return 0.42;
  if (lineId === 'ev-bb-hand-late' && status !== 'done' && hour >= 22) return 0.25;
  if (status === 'done') return 1;
  return 0;
}

export type DropCombinePlan =
  | { kind: 'combine'; other: string }
  | { kind: 'choose'; options: string[] }
  | { kind: 'nothing' };

export function dropCombinePlan(
  dragged: string,
  yielded: string[],
  owned: string[]
): DropCombinePlan {
  const ownedSet = new Set(owned);
  const candidates = [...new Set(yielded)].filter(
    (cardId) => cardId !== dragged && ownedSet.has(cardId)
  );
  if (candidates.length === 1) return { kind: 'combine', other: candidates[0] };
  if (candidates.length > 1) return { kind: 'choose', options: candidates };
  return { kind: 'nothing' };
}
