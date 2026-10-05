import { applyCssTokens } from '../cssTokens';
import { CELLS, CELL_BY_ID } from '../../world/damier';
import type { BuildingCallbacks, BuildingHandle, BuildingInput } from './building';
import type { SectionView } from './sectionLayout';

declare global {
  interface Window {
    __buildingReady?: boolean;
    __buildingStats?: ReturnType<BuildingHandle['stats']>;
    __buildingError?: string;
  }
}

const params = new URLSearchParams(window.location.search);
const focusParam = params.get('focus') || '3:6';
const focus = CELL_BY_ID[focusParam] ? focusParam : '3:6';
const viewParam = params.get('view');
const view: SectionView = viewParam === 'block' || viewParam === 'building' ? viewParam : 'room';
const hourParam = Number(params.get('hour'));
const hour = ([20, 21, 22, 23].includes(hourParam) ? hourParam : 20) as BuildingInput['hour'];
const mode = params.get('mode') === 'blueprint' ? 'blueprint' : 'print';
const visitedParam = params.get('visited');
const visited =
  visitedParam === 'all'
    ? CELLS.map((cell) => cell.id)
    : visitedParam === 'none' || !visitedParam
      ? []
      : visitedParam.split(',').filter((cellId) => Boolean(CELL_BY_ID[cellId]));

function targetsFor(cellId: string): BuildingInput['targets'] {
  if (params.get('targets') !== '1') return {};
  const cell = CELL_BY_ID[cellId];
  if (!cell) return {};
  const targets: BuildingInput['targets'] = {};
  const offsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ];
  for (const [floorOffset, columnOffset] of offsets) {
    const target = `${cell.floor + floorOffset}:${cell.col + columnOffset}`;
    if (CELL_BY_ID[target] && target !== cellId) targets[target] = { kind: 'knight', minutes: 24 };
  }
  return targets;
}

async function mount() {
  await document.fonts.ready;
  applyCssTokens();
  const host = document.getElementById('building-stage');
  if (!host) throw new Error('Building stage host is missing.');

  let focusCell = focus;
  let currentView = view;
  let handle: BuildingHandle | null = null;
  let currentInput: BuildingInput = {
    current: focusCell,
    focus: focusCell,
    view: currentView,
    hour,
    mode,
    visited,
    lamps: [],
    changed: [],
    targets: targetsFor(focusCell),
    hotspots: [],
    highlight: null,
    lastMove: null,
  };
  const callbacks: BuildingCallbacks = {
    onPickHotspot: () => undefined,
    onPickCell: (cellId) => {
      focusCell = cellId;
      currentInput = { ...currentInput, focus: focusCell, targets: targetsFor(focusCell) };
      handle?.update(currentInput);
      publishWhenIdle();
    },
    onHoverCell: () => undefined,
    onViewChange: (nextView) => {
      currentView = nextView;
      currentInput = { ...currentInput, view: currentView };
      handle?.update(currentInput);
      publishWhenIdle();
    },
  };
  const { mountBuilding } = await import('./building');
  handle = mountBuilding(host, currentInput, callbacks);
  window.__buildingReady = false;

  function publishWhenIdle() {
    const stats = handle?.stats();
    if (!stats) return;
    window.__buildingStats = stats;
    if (stats.idle && stats.firstReadyMs !== null) {
      window.__buildingReady = true;
      return;
    }
    window.requestAnimationFrame(publishWhenIdle);
  }
  publishWhenIdle();
}

void mount().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  window.__buildingError = message;
  const errorNode = document.getElementById('building-error');
  if (errorNode) {
    errorNode.textContent = `纸剧场无法打开：${message}`;
    errorNode.style.display = 'block';
  }
  throw error;
});
