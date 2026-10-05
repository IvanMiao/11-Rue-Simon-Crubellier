export interface StageHotspot {
  lineId: string;
  status: 'open' | 'locked' | 'done' | 'failed';
  kind: 'look' | 'check' | 'item' | 'finale';
}
