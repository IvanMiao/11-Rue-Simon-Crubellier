import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CaseGraph } from '../../case/types';
import type { Action, GameEvent } from '../../engine/types';
import type { PlayerState } from '../../types';
import { TONES } from '../../art/palette';
import { clockLabel } from '../../utils/gameLogic';
import { CELLS, CLINAMEN_CELL, cellTitle, chapterNumeral, CELL_BY_ID } from '../../world/damier';
import {
  cardProvenance,
  moveCostTo,
  nextHourPage,
  roomSheet,
  roomSignals,
  type SheetLine,
} from '../../engine/selectors';
import type {
  BuildingCallbacks,
  BuildingHandle,
  BuildingInput,
  StageHotspot,
} from '../../art/stage/building';
import { MECHANISMS } from '../../art/stage/mechanisms';
import type { SectionView } from '../../art/stage/sectionLayout';
import {
  AUDIO_SETTINGS_KEY,
  DEFAULT_AUDIO_SETTINGS,
  parseAudioSettings,
  serializeAudioSettings,
  type AudioSettings,
  type Cue,
} from '../../audio/cues';
import { createAudioController, type AudioController } from '../../audio/audio';
import { cuesForGameEvents } from '../../audio/events';
import DamierCanvas, { type Hour, type MoveTarget } from './DamierCanvas';
import RoomPage, { type PendingLineCheck } from './RoomPage';
import Notebook, { type Arrival } from './Notebook';
import BuildingStage from './BuildingStage';
import CardTray from './CardTray';

interface WorldScreenProps {
  state: PlayerState;
  graph: CaseGraph | null;
  generatingCellIds: ReadonlySet<string>;
  dispatch: (action: Action) => GameEvent[];
  onOpenCase: () => void;
  isCaseOpen: boolean;
  onReset: () => void;
}

const VIA_TEXT = { look: '观察', check: '检定', checkFail: '检定失败', recipe: '联想' } as const;

function hourOf(minutes: number): Hour {
  return Math.min(23, 20 + Math.floor(Math.max(0, minutes) / 60)) as Hour;
}

function coatToneFor(archetype?: string) {
  if (archetype?.includes('通灵者')) return TONES.aubergine;
  if (archetype?.includes('棋手')) return TONES.navy;
  return TONES.ochre;
}

function footnoteFor(state: PlayerState, cardId: string) {
  const source = cardProvenance(state, cardId);
  if (!source) return '';
  const chapter = source.chapter ? `第 ${chapterNumeral(source.chapter)} 章` : '';
  return [chapter, source.title, VIA_TEXT[source.via]].filter(Boolean).join(' · ');
}

/** The play screen: Valène's building section, the open chapter page, and the sketchbook. */
const WorldScreen: React.FC<WorldScreenProps> = ({
  state: liveState,
  graph,
  generatingCellIds,
  dispatch,
  onOpenCase,
  isCaseOpen,
  onReset,
}) => {
  const [frozen, setFrozen] = useState<PlayerState | null>(null);
  const [pending, setPending] = useState<{
    before: PlayerState;
    events: GameEvent[];
    lineId: string | null;
  } | null>(null);
  const [check, setCheck] = useState<PendingLineCheck | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [sectionView, setSectionView] = useState<SectionView>('room');
  const [closeUp, setCloseUp] = useState<string | null>(null);
  const [ambientEnabled, setAmbientEnabled] = useState(() => {
    try {
      return window.localStorage.getItem('building:ambient') !== 'off';
    } catch {
      return true;
    }
  });
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => {
    try {
      return parseAudioSettings(window.localStorage.getItem(AUDIO_SETTINGS_KEY));
    } catch {
      return { ...DEFAULT_AUDIO_SETTINGS };
    }
  });
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [trayOpen, setTrayOpen] = useState(false);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [caption, setCaption] = useState<{ title: string; text: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [notebookNew, setNotebookNew] = useState(false);
  const [highlightedLineId, setHighlightedLineId] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string; kind: 'walk' | 'knight' | 'elevator' } | null>(null);
  const arrivalSeq = useRef(0);
  const audioActionSeq = useRef(0);
  const audioRef = useRef<AudioController | null>(null);
  const trayCueOpen = useRef(false);
  const previousCaseOpen = useRef(isCaseOpen);
  const notebookRef = useRef<HTMLDivElement>(null);
  const buildingHandleRef = useRef<BuildingHandle | null>(null);
  const lastSourceLine = useRef<string | null>(null);

  const state = frozen || liveState;
  const elevatorFloorKey = `building:elevator-floor:${state.runSeed}`;
  const [elevatorFloor, setElevatorFloor] = useState(() => {
    if (typeof window === 'undefined') return 0;
    if (state.lastMoveKind === 'elevator' && state.currentRoomId) {
      return CELL_BY_ID[state.currentRoomId]?.floor ?? 0;
    }
    const stored = Number(window.localStorage.getItem(elevatorFloorKey));
    return Number.isInteger(stored) && stored >= -1 && stored <= 8 ? stored : 0;
  });
  const current = state.currentRoomId;
  const shownCell = viewing && state.visitedRooms[viewing] ? viewing : current;
  const playerCoatTone = coatToneFor(state.character?.archetype);
  const onAudioCue = useCallback((cue: Cue, key = '', delayMs = 0) => {
    audioRef.current?.play(cue, key, { delayMs });
  }, []);

  useEffect(() => {
    const controller = createAudioController({
      now: () => buildingHandleRef.current?.now() ?? performance.now(),
    });
    audioRef.current = controller;
    const unlock = () => {
      void controller.unlock();
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
    document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    document.addEventListener('keydown', unlock, true);
    return () => {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      controller.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    audioRef.current?.setSettings(audioSettings);
    try {
      window.localStorage.setItem(AUDIO_SETTINGS_KEY, serializeAudioSettings(audioSettings));
    } catch {
      return;
    }
  }, [audioSettings]);

  useEffect(() => {
    audioRef.current?.setBed(
      liveState.currentRoomId ?? '',
      hourOf(liveState.minutesPastEight)
    );
  }, [liveState.currentRoomId, liveState.minutesPastEight]);

  useEffect(() => {
    if (previousCaseOpen.current === isCaseOpen) return;
    previousCaseOpen.current = isCaseOpen;
    const opening = isCaseOpen;
    const key = `case-file:${liveState.runSeed}:${audioActionSeq.current}`;
    onAudioCue(opening ? 'book.open' : 'book.close', key);
    onAudioCue(opening ? 'map.open' : 'map.close', key, 180);
  }, [isCaseOpen, liveState.runSeed, onAudioCue]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    try {
      window.localStorage.setItem('building:ambient', ambientEnabled ? 'on' : 'off');
    } catch {
      return;
    }
  }, [ambientEnabled]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (isCaseOpen) {
      setCloseUp(null);
      setTrayOpen(false);
    }
  }, [isCaseOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setCloseUp(null);
      setTrayOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!check?.rolling) return;
    const tick = window.setInterval(() => setCheck((c) => (c ? { ...c, tick: c.tick + 1 } : c)), 80);
    const stop = window.setTimeout(() => setCheck((c) => (c ? { ...c, rolling: false } : c)), 950);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(stop);
    };
  }, [check?.rolling]);

  const settle = useCallback(
    (before: PlayerState, events: GameEvent[], after: PlayerState, sourceLineId: string | null = null) => {
    const had = new Set(before.case?.cards || []);
    const fresh = (after.case?.cards || []).filter((id) => !had.has(id));
    if (fresh.length) {
      const addArrival = (cardId: string, from?: { x: number; y: number }) => {
        const item = {
          key: `a${arrivalSeq.current++}`,
          cardId,
          footnote: footnoteFor(after, cardId),
          from,
        };
        setArrivals((list) => [...list, item].slice(-4));
        window.setTimeout(
          () => setArrivals((list) => list.filter((arrival) => arrival.key !== item.key)),
          4300
        );
      };
      const rect = notebookRef.current?.getBoundingClientRect();
      if (sourceLineId && rect && buildingHandleRef.current) {
        buildingHandleRef.current.animateCards(sourceLineId, fresh, rect, addArrival);
      } else {
        fresh.forEach((cardId) => addArrival(cardId));
      }
    }
    if (!before.case?.notebook && after.case?.notebook) {
      setNotebookNew(true);
      window.setTimeout(() => setNotebookNew(false), 1200);
    }
    for (const event of events) {
      if (event.type === 'hourTurned') setCaption({ title: `${event.title} · ${event.hour}:00`, text: event.text });
      if (event.type === 'rejected') setToast(event.reason);
      if (event.type === 'combined' && event.recipeId === null) setToast(event.text);
      if (event.type === 'groupLocked') setToast('这一组对上了。');
      if (event.type === 'groupRejected') setToast('对不上。至少有一格错了。意志 −1');
      if (event.type === 'knightTour') setToast(`骑士连跳 ${event.chain} 格。意志 +1`);
    }
  }, []);

  const act = useCallback(
    (action: Action, lineId?: string) => {
      const before = liveState;
      const events = dispatch(action);
      const actionKey = `${liveState.runSeed}:${liveState.minutesPastEight}:${audioActionSeq.current++}`;
      cuesForGameEvents(events, before.visitedRooms, actionKey).forEach(({ cue, key, ...options }) => {
        audioRef.current?.play(cue, key, options);
      });
      const rolled = events.find((e) => e.type === 'checkRolled');
      if (rolled?.type === 'checkRolled' && lineId) {
        setFrozen(before);
        setPending({ before, events, lineId });
        setCheck({ lineId, result: rolled.result, rolling: true, tick: 0 });
        return;
      }
      setArmed(null);
      return events;
    },
    [dispatch, liveState]
  );

  // Settle non-check actions once the engine state has advanced.
  const lastSettled = useRef<PlayerState>(liveState);
  const lastEvents = useRef<GameEvent[]>([]);
  const dispatchAndRecord = useCallback(
    (action: Action, lineId?: string) => {
      const events = act(action, lineId);
      if (events) {
        lastEvents.current = events;
        lastSourceLine.current = lineId ?? null;
        const moved = events.find((event) => event.type === 'moved');
        if (moved?.type === 'moved') {
          setLastMove({ from: moved.from || moved.to, to: moved.to, kind: moved.kind });
          if (moved.kind === 'elevator') {
            const floor = CELL_BY_ID[moved.to]?.floor ?? 0;
            setElevatorFloor(floor);
            window.localStorage.setItem(elevatorFloorKey, String(floor));
          }
          setViewing(null);
          setSectionView('room');
          setCloseUp(null);
          setTrayOpen(false);
        }
      }
    },
    [act]
  );
  useEffect(() => {
    if (frozen) return;
    if (lastSettled.current !== liveState) {
      settle(lastSettled.current, lastEvents.current, liveState, lastSourceLine.current);
      lastSettled.current = liveState;
      lastEvents.current = [];
      lastSourceLine.current = null;
    }
  }, [liveState, frozen, settle]);

  const finishCheck = () => {
    if (!pending) return;
    settle(pending.before, pending.events, liveState, pending.lineId);
    lastSettled.current = liveState;
    setPending(null);
    setCheck(null);
    setFrozen(null);
    setArmed(null);
  };

  const signals = useMemo(() => roomSignals(state) as Record<string, string[]>, [state]);
  const lamps = useMemo(
    () => new Set(Object.entries(signals).filter(([, s]) => (s as string[]).includes('lamp')).map(([id]) => id)),
    [signals]
  );
  const changed = useMemo(
    () => new Set(Object.entries(signals).filter(([, s]) => (s as string[]).includes('changed')).map(([id]) => id)),
    [signals]
  );
  const targets = useMemo(() => {
    const out: Record<string, MoveTarget> = {};
    if (state.runStatus !== 'playing' || frozen) return out;
    CELLS.forEach((cell) => {
      if (cell.id === current) return;
      const cost = moveCostTo(state, cell.id);
      if (cost) out[cell.id] = cost;
    });
    return out;
  }, [state, current, frozen]);
  const visited = useMemo(() => new Set(Object.keys(state.visitedRooms)), [state.visitedRooms]);
  const sheet = useMemo(() => (shownCell ? roomSheet(state, shownCell) : null), [state, shownCell]);
  const next = nextHourPage(state);

  const onSelectCell = (cellId: string) => {
    if (frozen) return;
    if (targets[cellId]) {
      setViewing(null);
      setCloseUp(null);
      setTrayOpen(false);
      dispatchAndRecord({ type: 'move', roomId: cellId });
      return;
    }
    if (cellId === current) {
      setViewing(null);
      setCloseUp(null);
      return;
    }
    if (state.visitedRooms[cellId]) {
      setViewing(cellId);
      setCloseUp(null);
      setTrayOpen(false);
      return;
    }
    setToast(cellId === CLINAMEN_CELL ? '这一格被咬掉了。骑士跳不进去。' : `${cellTitle(cellId)} 现在走不到。`);
  };

  const onLine = (line: SheetLine) => {
    if (line.kind === 'item') dispatchAndRecord({ type: 'collect', itemId: line.id }, line.id);
    else dispatchAndRecord({ type: 'interact', interactionId: line.id }, line.id);
  };
  const titleForCell = useCallback((id: string) => {
    const cell = CELL_BY_ID[id];
    const target = targets[id];
    const head = cell?.chapter ? `第 ${chapterNumeral(cell.chapter)} 章 · ` : '';
    const kind = target?.kind === 'knight' ? '骑士跳' : target?.kind === 'elevator' ? '电梯' : '走过去';
    return `${head}${cellTitle(id)}${target ? ` · ${kind} ${target.minutes} 分钟` : ''}`;
  }, [targets]);
  const poseHotspots = useMemo<StageHotspot[]>(() => {
    if (!sheet) return [];
    return sheet.lines.map((line) => ({
      lineId: line.id,
      status: line.status,
      kind: line.kind,
      lock: line.lock,
      yielded: line.yielded,
    }));
  }, [sheet]);
  const poseHotspotsByCell = useMemo(
    () =>
      Object.fromEntries(
        [...new Set(Object.values(MECHANISMS).map((spec) => spec.cellId))].map((cellId) => [
          cellId,
          roomSheet(state, cellId).lines.map((line) => ({
            lineId: line.id,
            status: line.status,
            kind: line.kind,
            lock: line.lock,
            yielded: line.yielded,
          })),
        ])
      ),
    [state]
  );
  const hotspots = viewing ? [] : poseHotspots;
  const sectionInput = useMemo<BuildingInput>(() => ({
    current,
    focus: shownCell || current,
    elevatorFloor,
    view: sectionView,
    closeUp,
    hour: hourOf(state.minutesPastEight),
    mode: isCaseOpen ? 'blueprint' : 'print',
    visited: Array.from(visited),
    lamps: Array.from(lamps),
    changed: Array.from(changed),
    targets,
    hotspots,
    poseHotspots,
    poseHotspotsByCell,
    highlight: viewing ? null : highlightedLineId,
    armedLineId: armed,
    lastMove,
    ambient: ambientEnabled,
    reducedMotion,
  }), [
    current,
    shownCell,
    elevatorFloor,
    sectionView,
    closeUp,
    state.minutesPastEight,
    isCaseOpen,
    visited,
    lamps,
    changed,
    targets,
    hotspots,
    poseHotspots,
    poseHotspotsByCell,
    armed,
    viewing,
    highlightedLineId,
    lastMove,
    ambientEnabled,
    reducedMotion,
  ]);
  const buildingCallbacks = useMemo<BuildingCallbacks>(() => ({
    onAudioCue,
    onPickHotspot: (lineId) => {
      const line = sheet?.lines.find((candidate) => candidate.id === lineId);
      if (!line || viewing || check) return;
      if (line.status !== 'open') {
        onAudioCue('lock.rattle', line.id);
        return;
      }
      if (line.kind === 'check') {
        if (armed !== line.id) onAudioCue('dice.grab', line.id);
        setArmed(armed === line.id ? null : line.id);
      } else onLine(line);
    },
    onPickCell: onSelectCell,
    onHoverCell: () => undefined,
    onHoverLine: setHighlightedLineId,
    onCloseUp: setCloseUp,
    onExitCloseUp: () => setCloseUp(null),
    getNotebookRect: () => notebookRef.current?.getBoundingClientRect() ?? null,
    onViewChange: (view) => {
      setCloseUp(null);
      setSectionView(view);
    },
    onAmbientSimplified: () => setToast('动态已简化'),
  }), [sheet, viewing, check, armed, onLine, onSelectCell, setToast, onAudioCue]);
  const getPartAt = useCallback(
    (clientX: number, clientY: number) => buildingHandleRef.current?.partAt(clientX, clientY) ?? null,
    []
  );
  const onCombineCards = useCallback(
    (dragged: string, other: string, lineId: string) =>
      dispatchAndRecord({ type: 'combine', a: dragged, b: other }, lineId),
    [dispatchAndRecord]
  );
  const onWobblePart = useCallback((lineId: string) => {
    buildingHandleRef.current?.wobblePart(lineId);
    onAudioCue('drop.nothing', lineId);
  }, [onAudioCue]);
  const openTray = useCallback(() => {
    if (!trayCueOpen.current) {
      trayCueOpen.current = true;
      onAudioCue('paper.fan', `tray:${audioActionSeq.current++}`);
    }
    setTrayOpen(true);
  }, [onAudioCue]);
  useEffect(() => {
    if (!trayOpen) trayCueOpen.current = false;
  }, [trayOpen]);
  const armLine = useCallback((lineId: string | null) => {
    if (lineId && lineId !== armed) onAudioCue('dice.grab', lineId);
    setArmed(lineId);
  }, [armed, onAudioCue]);
  const changeAudioSetting = useCallback((field: 'master' | 'ambience' | 'music', value: number) => {
    setAudioSettings((settings) => ({ ...settings, [field]: value }));
  }, []);
  const onDropTarget = useCallback((lineId: string | null) => {
    if (lineId === null) buildingHandleRef.current?.partAt(-1, -1);
  }, []);
  const canDropCards =
    Boolean(state.case?.notebook) &&
    !isCaseOpen &&
    !check &&
    !frozen &&
    !viewing &&
    shownCell === current &&
    sectionView === 'room';

  return (
    <div className="world-desk h-screen w-screen overflow-hidden flex flex-col">
      <header className="hud-strip px-4 md:px-6 py-3 shrink-0">
        <span className="world-kicker opacity-70 !text-[color:var(--linen)] hidden md:inline">11, rue Simon-Crubellier</span>
        <span className="hud-clock ml-auto md:ml-6">
          <b className="text-base">{clockLabel(state.minutesPastEight)}</b>
          <span className="opacity-70">{next ? `下次换光 ${next.hour}:00` : '午夜之前不再换光'}</span>
        </span>
        <span className="flex gap-1.5 items-center" aria-label={`意志 ${state.morale}/${state.maxMorale}`}>
          <span className="opacity-70 mr-1">意志</span>
          {Array.from({ length: state.maxMorale }, (_, i) => (
            <span key={i} className={`hud-stamp ${i < state.morale ? 'is-on' : ''}`} />
          ))}
        </span>
        {state.knightChain > 0 && <span className="opacity-80">♞ 连跳 {state.knightChain}</span>}
        <button className="ml-auto opacity-60 hover:opacity-100 underline" onClick={onReset}>
          放弃此局
        </button>
      </header>

      <main className="flex-1 min-h-0 grid md:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] gap-4 px-4 md:px-6 pb-4">
        <section className="building-section-panel paper-sheet min-h-0" aria-label="全楼剖面">
          <BuildingStage
            input={sectionInput}
            callbacks={buildingCallbacks}
            onHandleReady={(handle) => {
              buildingHandleRef.current = handle;
            }}
            fallback={
              <DamierCanvas
                cells={CELLS}
                visited={visited}
                clinamenId={CLINAMEN_CELL}
                hour={hourOf(state.minutesPastEight)}
                current={current}
                lastMove={lastMove}
                lamps={lamps}
                changed={changed}
                targets={targets}
                selected={viewing}
                onSelect={onSelectCell}
                titleFor={titleForCell}
                className="paper-sheet"
              />
            }
          />
          <div className="building-view-tabs" role="group" aria-label="剖面视图">
            {closeUp ? (
              <button type="button" className="is-active" onClick={() => setCloseUp(null)}>退后</button>
            ) : (
              <>
                {([
                  ['room', '近'],
                  ['block', '邻'],
                  ['building', '全楼'],
                ] as const).map(([view, label]) => (
                  <button
                    key={view}
                    type="button"
                    className={sectionView === view ? 'is-active' : ''}
                    aria-pressed={sectionView === view}
                    onClick={() => setSectionView(view)}
                  >
                    {label}
                  </button>
                ))}
                {shownCell !== current && (
                  <button type="button" onClick={() => setViewing(null)}>回到当前格</button>
                )}
              </>
            )}
            <button
              type="button"
              className="motion-switch"
              aria-pressed={ambientEnabled}
              onClick={() => setAmbientEnabled((enabled) => !enabled)}
            >
              动态 {ambientEnabled ? '开' : '关'}
            </button>
            <button
              type="button"
              className="sound-switch"
              aria-pressed={!audioSettings.muted}
              aria-label="声音 开/关"
              onClick={() => setAudioSettings((settings) => ({ ...settings, muted: !settings.muted }))}
            >
              声音 {audioSettings.muted ? '关' : '开'}
            </button>
            <button
              type="button"
              className="sound-settings-toggle"
              aria-expanded={audioSettingsOpen}
              aria-controls="audio-settings-panel"
              onClick={() => setAudioSettingsOpen((open) => !open)}
            >
              音量
            </button>
          </div>
          {audioSettingsOpen && (
            <section id="audio-settings-panel" className="audio-settings-panel" aria-label="声音设置">
              <div className="audio-settings-heading">
                <span>纸声与房间</span>
                <button type="button" onClick={() => setAudioSettingsOpen(false)} aria-label="关闭声音设置">×</button>
              </div>
              {([
                ['master', '总音量'],
                ['ambience', '环境声'],
                ['music', '音乐'],
              ] as const).map(([field, label]) => (
                <label key={field} className="audio-setting-row">
                  <span>{label}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={audioSettings[field]}
                    aria-label={label}
                    onChange={(event) => changeAudioSetting(field, Number(event.currentTarget.value))}
                  />
                  <output>{audioSettings[field]}</output>
                </label>
              ))}
            </section>
          )}
          {caption && (
            <div className="building-hour-caption" key={caption.title}>
              <div className="world-kicker">{caption.title}</div>
              <div className="world-prose text-sm mt-1">{caption.text}</div>
            </div>
          )}
          <div className="building-notebook">
            <Notebook
              owned={Boolean(state.case?.notebook)}
              justFound={notebookNew}
              cards={state.case?.cards.length || 0}
              locked={state.case?.lockedGroups.length || 0}
              graph={graph}
              arrivals={arrivals}
              onOpen={onOpenCase}
              rootRef={notebookRef}
              onTrayOpen={openTray}
            />
            <CardTray
              open={trayOpen && Boolean(state.case?.notebook)}
              cards={state.case?.cards ?? []}
              graph={graph}
              lines={sheet?.lines ?? []}
              canDrop={canDropCards}
              anchorRef={notebookRef}
              getPartAt={getPartAt}
              onTarget={onDropTarget}
              onCombine={onCombineCards}
              onWobble={onWobblePart}
              onOpenCase={onOpenCase}
              onClose={() => setTrayOpen(false)}
            />
          </div>
          <span className="building-legend hidden lg:block">
            金色纸签 = 骑士跳 · 白色纸签 = 走过去 · 亮灯 = 这一格还有东西可看
          </span>
          <div className="sr-only" aria-label="可移动到的格子">
            {Object.keys(targets).map((cellId) => (
              <button key={cellId} type="button" title={titleForCell(cellId)} onClick={() => onSelectCell(cellId)}>
                {titleForCell(cellId)}
              </button>
            ))}
          </div>
        </section>

        <div className="min-h-0 overflow-y-auto pr-1 pb-6">
          {sheet && (
            <RoomPage
              sheet={sheet}
              prose={state.visitedRooms[sheet.cellId]}
              generating={generatingCellIds.has(sheet.cellId)}
              graph={graph}
              armedLineId={armed}
              check={check}
              onArm={armLine}
              onAct={onLine}
              onCheckDone={finishCheck}
              playerCoatTone={playerCoatTone}
              highlightedLineId={highlightedLineId}
              onHighlightLine={setHighlightedLineId}
              readOnly={sheet.cellId !== current}
            />
          )}
        </div>
      </main>

      {toast && <div className="world-toast">{toast}</div>}
    </div>
  );
};

export default WorldScreen;
