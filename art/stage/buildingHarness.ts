import { applyCssTokens } from '../cssTokens';
import { CELLS, CELL_BY_ID } from '../../world/damier';
import type { LockReason } from '../../engine/types';
import type { BuildingCallbacks, BuildingHandle, BuildingInput } from './building';
import type { SectionView } from './sectionLayout';
import type { StageHotspot } from './types';
import { MECHANISMS } from './mechanisms';
import { createAudioController } from '../../audio/audio';

declare global {
  interface Window {
    __advance?: (ms: number) => Promise<ReturnType<BuildingHandle['stats']>>;
  }
}

const params = new URLSearchParams(window.location.search);
const manualClock = params.get('clock') === 'manual';
const audioLogEnabled = params.get('audioLog') === '1';
const pinCamera = params.get('pinCamera') === '1';
const mechParam = params.get('mech');
const lockParam = params.get('lock');
const closeUpParam = params.get('closeUp');
const focusFromMechanism =
  (mechParam && MECHANISMS[mechParam]?.cellId) ||
  (lockParam && MECHANISMS[lockParam]?.cellId) ||
  (closeUpParam && MECHANISMS[closeUpParam]?.cellId);
const focusParam = params.get('focus') || focusFromMechanism || '3:6';
const focus = CELL_BY_ID[focusParam] ? focusParam : '3:6';
const viewParam = params.get('view');
const view: SectionView = viewParam === 'block' || viewParam === 'building' ? viewParam : 'room';
const hourParam = Number(params.get('hour'));
const hour = ([20, 21, 22, 23].includes(hourParam) ? hourParam : 20) as BuildingInput['hour'];
const hourToParam = Number(params.get('hourTo'));
const previewHourTo = ([20, 21, 22, 23].includes(hourToParam)
  ? hourToParam
  : null) as BuildingInput['hour'] | null;
const moveToParam = params.get('moveTo');
const moveKindParam = params.get('moveKind');
const previewMoveKind =
  moveKindParam === 'walk' || moveKindParam === 'knight' || moveKindParam === 'elevator'
    ? moveKindParam
    : null;
const previewMoveTo = moveToParam && CELL_BY_ID[moveToParam] ? moveToParam : null;
const mode = params.get('mode') === 'blueprint' ? 'blueprint' : 'print';
const visitedParam = params.get('visited');
const visited =
  visitedParam === 'all'
    ? CELLS.map((cell) => cell.id)
    : visitedParam === 'none' || !visitedParam
      ? []
      : visitedParam.split(',').filter((cellId) => Boolean(CELL_BY_ID[cellId]));
const lampsParam = params.get('lamps');
const lamps =
  lampsParam === 'all'
    ? CELLS.map((cell) => cell.id)
    : lampsParam
      ? lampsParam.split(',').filter((cellId) => Boolean(CELL_BY_ID[cellId]))
      : [];
const validStatuses = ['open', 'locked', 'done', 'failed'] as const;
const statusParam = params.get('status');
const previewStatus = validStatuses.find((status) => status === statusParam) ?? 'open';
const progressValue = Number(params.get('progress'));
const previewMechanism =
  mechParam && MECHANISMS[mechParam]
    ? {
        lineId: mechParam,
        progress: Number.isFinite(progressValue) ? Math.max(0, Math.min(1, progressValue)) : 0,
      }
    : undefined;
const parallaxValue = Number(params.get('parallax'));
const previewParallax = params.has('parallax') && Number.isFinite(parallaxValue) ? parallaxValue : undefined;

function previewHotspots(): StageHotspot[] {
  const lineIds = [...new Set([mechParam, lockParam, closeUpParam].filter((id): id is string => Boolean(id)))];
  return lineIds.flatMap((lineId) => {
    const spec = MECHANISMS[lineId];
    if (!spec) return [];
    const lock: LockReason | undefined =
      lineId === lockParam || (lineId === mechParam && previewStatus === 'locked')
        ? { kind: 'notBefore', minute: 120 }
        : lineId === mechParam && previewStatus === 'failed'
          ? { kind: 'needsNewCard' }
          : undefined;
    return [{
      lineId,
      status:
        lineId === lockParam
          ? 'locked'
          : lineId === mechParam
            ? previewStatus
            : 'open',
      kind: lineId.startsWith('it-') ? 'item' : lineId === 'ev-bb-hand' ? 'check' : 'look',
      lock,
    }];
  });
}

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
  const audioController = audioLogEnabled
    ? createAudioController({
        now: () => handle?.now() ?? performance.now(),
        captureOnly: true,
      })
    : null;
  let currentInput: BuildingInput = {
    current: focusCell,
    focus: focusCell,
    elevatorFloor: 0,
    view: currentView,
    closeUp: !manualClock && closeUpParam && MECHANISMS[closeUpParam] ? closeUpParam : null,
    hour,
    mode,
    visited,
    lamps,
    changed: [],
    targets: targetsFor(focusCell),
    hotspots: previewHotspots(),
    poseHotspots: previewHotspots(),
    poseHotspotsByCell: { [focusCell]: previewHotspots() },
    highlight: mechParam || lockParam || closeUpParam || null,
    armedLineId: null,
    previewMechanism,
    previewLockLine: lockParam && MECHANISMS[lockParam] ? lockParam : null,
    previewParallax,
    lastMove: null,
    ambient: params.get('ambient') !== 'off',
    reducedMotion: params.get('reducedMotion') === '1',
    clockMode: manualClock ? 'manual' : 'realtime',
    pinCamera,
  };
  const callbacks: BuildingCallbacks = {
    onAudioCue: (cue, key, delayMs) => audioController?.play(cue, key, { delayMs }),
    onPickHotspot: () => undefined,
    onPickCell: (cellId) => {
      focusCell = cellId;
      const hotspots = previewHotspots();
      currentInput = {
        ...currentInput,
        focus: focusCell,
        targets: targetsFor(focusCell),
        hotspots,
        poseHotspots: hotspots,
        poseHotspotsByCell: { [focusCell]: hotspots },
      };
      handle?.update(currentInput);
      publishWhenIdle();
    },
    onHoverCell: () => undefined,
    onHoverLine: () => undefined,
    onCloseUp: (lineId) => {
      currentInput = { ...currentInput, closeUp: lineId };
      handle?.update(currentInput);
      publishWhenIdle();
    },
    onExitCloseUp: () => {
      currentInput = { ...currentInput, closeUp: null };
      handle?.update(currentInput);
      publishWhenIdle();
    },
    getNotebookRect: () => null,
    onViewChange: (nextView) => {
      currentView = nextView;
      currentInput = { ...currentInput, view: currentView };
      handle?.update(currentInput);
      publishWhenIdle();
    },
    onAmbientSimplified: () => undefined,
  };
  const { mountBuilding } = await import('./building');
  handle = mountBuilding(host, currentInput, callbacks);
  if (audioController) {
    window.addEventListener('pagehide', () => audioController.dispose(), { once: true });
  }
  const idleCallbacks: Array<() => void> = [];
  const readyWaiters: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  let ready = false;
  let readyError: Error | null = null;

  const waitUntilReady = () => {
    if (ready) return Promise.resolve();
    if (readyError) return Promise.reject(readyError);
    return new Promise<void>((resolve, reject) => {
      readyWaiters.push({ resolve, reject });
    });
  };

  const markReady = () => {
    if (ready) return;
    ready = true;
    readyWaiters.splice(0).forEach(({ resolve }) => resolve());
    idleCallbacks.splice(0).forEach((callback) => callback());
  };

  const failReady = (error: unknown) => {
    if (ready || readyError) return;
    readyError = error instanceof Error ? error : new Error(String(error));
    readyWaiters.splice(0).forEach(({ reject }) => reject(readyError!));
  };

  if (manualClock) {
    window.__advance = async (ms) => {
      await waitUntilReady();
      if (!handle) throw new Error('Building stage is unavailable');
      await handle.advance(ms);
      return handle.stats();
    };
  }

  function publishWhenIdle() {
    const stats = handle?.stats();
    if (!stats) return;
    if (stats.idle && stats.firstReadyMs !== null) {
      markReady();
      return;
    }
    if (manualClock) {
      if (ready) return;
      void handle?.advance(0).then(publishWhenIdle).catch((error: unknown) => {
        failReady(error);
      });
    } else {
      window.requestAnimationFrame(publishWhenIdle);
    }
  }
  publishWhenIdle();
  const whenIdle = (callback: () => void) => {
    if (ready) {
      callback();
      return;
    }
    if (manualClock) {
      idleCallbacks.push(callback);
      return;
    }
    const poll = () => {
      const stats = handle?.stats();
      if (stats?.firstReadyMs !== null && stats?.idle) {
        callback();
        return;
      }
      window.requestAnimationFrame(poll);
    };
    poll();
  };
  if (manualClock && closeUpParam && MECHANISMS[closeUpParam]) {
    whenIdle(() => {
      currentInput = { ...currentInput, closeUp: closeUpParam };
      handle?.update(currentInput);
    });
  }
  if (previewHourTo !== null && previewHourTo !== hour) {
    whenIdle(() => {
      const updateHour = () => {
        currentInput = { ...currentInput, hour: previewHourTo };
        handle?.update(currentInput);
        publishWhenIdle();
      };
      if (manualClock) updateHour();
      else window.setTimeout(updateHour, 300);
    });
  }
  if (previewMoveTo && previewMoveKind) {
    whenIdle(() => {
      currentInput = {
        ...currentInput,
        current: previewMoveTo,
        focus: pinCamera ? focusCell : previewMoveTo,
        view: pinCamera ? 'block' : 'room',
        closeUp: null,
        visited: Array.from(new Set([...currentInput.visited, previewMoveTo])),
        elevatorFloor:
          previewMoveKind === 'elevator'
            ? (CELL_BY_ID[previewMoveTo]?.floor ?? currentInput.elevatorFloor)
            : currentInput.elevatorFloor,
        targets: targetsFor(previewMoveTo),
        poseHotspotsByCell: { ...currentInput.poseHotspotsByCell, [previewMoveTo]: previewHotspots() },
        lastMove: { from: focusCell, to: previewMoveTo, kind: previewMoveKind },
      };
      handle?.update(currentInput);
      if (!manualClock) publishWhenIdle();
    });
  }
}

void mount().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const errorNode = document.getElementById('building-error');
  if (errorNode) {
    errorNode.textContent = `纸剧场无法打开：${message}`;
    errorNode.style.display = 'block';
  }
  throw error;
});
