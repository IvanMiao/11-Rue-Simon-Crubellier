import type { LockReason } from '../../engine/types';

export interface StageHotspot {
  lineId: string;
  status: 'open' | 'locked' | 'done' | 'failed';
  kind: 'look' | 'check' | 'item' | 'finale';
  lock?: LockReason;
  yielded?: string[];
}
