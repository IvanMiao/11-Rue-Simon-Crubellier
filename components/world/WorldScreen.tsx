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
import type { BuildingCallbacks, BuildingInput, StageHotspot } from '../../art/stage/building';
import type { SectionView } from '../../art/stage/sectionLayout';
import DamierCanvas, { type Hour, type MoveTarget } from './DamierCanvas';
import RoomPage, { type PendingLineCheck } from './RoomPage';
import Notebook, { type Arrival } from './Notebook';
import BuildingStage from './BuildingStage';

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
  const [pending, setPending] = useState<{ before: PlayerState; events: GameEvent[] } | null>(null);
  const [check, setCheck] = useState<PendingLineCheck | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [sectionView, setSectionView] = useState<SectionView>('room');
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [caption, setCaption] = useState<{ title: string; text: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [notebookNew, setNotebookNew] = useState(false);
  const [highlightedLineId, setHighlightedLineId] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string; kind: 'walk' | 'knight' | 'elevator' } | null>(null);
  const arrivalSeq = useRef(0);

  const state = frozen || liveState;
  const current = state.currentRoomId;
  const shownCell = viewing && state.visitedRooms[viewing] ? viewing : current;
  const playerCoatTone = coatToneFor(state.character?.archetype);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!check?.rolling) return;
    const tick = window.setInterval(() => setCheck((c) => (c ? { ...c, tick: c.tick + 1 } : c)), 80);
    const stop = window.setTimeout(() => setCheck((c) => (c ? { ...c, rolling: false } : c)), 950);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(stop);
    };
  }, [check?.rolling]);

  const settle = useCallback((before: PlayerState, events: GameEvent[], after: PlayerState) => {
    const had = new Set(before.case?.cards || []);
    const fresh = (after.case?.cards || []).filter((id) => !had.has(id));
    if (fresh.length) {
      const items = fresh.map((cardId) => ({ key: `a${arrivalSeq.current++}`, cardId, footnote: footnoteFor(after, cardId) }));
      setArrivals((list) => [...list, ...items].slice(-4));
      window.setTimeout(() => setArrivals((list) => list.filter((a) => !items.some((i) => i.key === a.key))), 4300);
    }
    if (!before.case?.notebook && after.case?.notebook) {
      setNotebookNew(true);
      window.setTimeout(() => setNotebookNew(false), 1200);
    }
    for (const event of events) {
      if (event.type === 'hourTurned') setCaption({ title: `${event.title} · ${event.hour}:00`, text: event.text });
      if (event.type === 'rejected') setToast(event.reason);
      if (event.type === 'groupLocked') setToast('这一组对上了。');
      if (event.type === 'groupRejected') setToast('对不上。至少有一格错了。意志 −1');
      if (event.type === 'knightTour') setToast(`骑士连跳 ${event.chain} 格。意志 +1`);
    }
  }, []);

  const act = useCallback(
    (action: Action, lineId?: string) => {
      const before = liveState;
      const events = dispatch(action);
      const rolled = events.find((e) => e.type === 'checkRolled');
      if (rolled?.type === 'checkRolled' && lineId) {
        setFrozen(before);
        setPending({ before, events });
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
        const moved = events.find((event) => event.type === 'moved');
        if (moved?.type === 'moved') {
          setLastMove({ from: moved.from || moved.to, to: moved.to, kind: moved.kind });
          setViewing(null);
          setSectionView('room');
        }
      }
    },
    [act]
  );
  useEffect(() => {
    if (frozen) return;
    if (lastSettled.current !== liveState) {
      settle(lastSettled.current, lastEvents.current, liveState);
      lastSettled.current = liveState;
      lastEvents.current = [];
    }
  }, [liveState, frozen, settle]);

  const finishCheck = () => {
    if (!pending) return;
    settle(pending.before, pending.events, liveState);
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
      dispatchAndRecord({ type: 'move', roomId: cellId });
      return;
    }
    if (cellId === current) {
      setViewing(null);
      return;
    }
    if (state.visitedRooms[cellId]) {
      setViewing(cellId);
      return;
    }
    setToast(cellId === CLINAMEN_CELL ? '这一格被咬掉了。骑士跳不进去。' : `${cellTitle(cellId)} 现在走不到。`);
  };

  const onLine = (line: SheetLine) => {
    if (line.kind === 'item') dispatchAndRecord({ type: 'collect', itemId: line.id });
    else dispatchAndRecord({ type: 'interact', interactionId: line.id }, line.id);
  };
  const titleForCell = useCallback((id: string) => {
    const cell = CELL_BY_ID[id];
    const target = targets[id];
    const head = cell?.chapter ? `第 ${chapterNumeral(cell.chapter)} 章 · ` : '';
    const kind = target?.kind === 'knight' ? '骑士跳' : target?.kind === 'elevator' ? '电梯' : '走过去';
    return `${head}${cellTitle(id)}${target ? ` · ${kind} ${target.minutes} 分钟` : ''}`;
  }, [targets]);
  const hotspots = useMemo<StageHotspot[]>(() => {
    if (!sheet || viewing) return [];
    return sheet.lines.map((line) => ({ lineId: line.id, status: line.status, kind: line.kind }));
  }, [sheet, viewing]);
  const sectionInput = useMemo<BuildingInput>(() => ({
    current,
    focus: shownCell || current,
    view: sectionView,
    hour: hourOf(state.minutesPastEight),
    mode: isCaseOpen ? 'blueprint' : 'print',
    visited: Array.from(visited),
    lamps: Array.from(lamps),
    changed: Array.from(changed),
    targets,
    hotspots,
    highlight: viewing ? null : highlightedLineId,
    lastMove,
  }), [
    current,
    shownCell,
    sectionView,
    state.minutesPastEight,
    isCaseOpen,
    visited,
    lamps,
    changed,
    targets,
    hotspots,
    viewing,
    highlightedLineId,
    lastMove,
  ]);
  const buildingCallbacks = useMemo<BuildingCallbacks>(() => ({
    onPickHotspot: (lineId) => {
      const line = sheet?.lines.find((candidate) => candidate.id === lineId);
      if (!line || line.status !== 'open' || viewing || check) return;
      if (line.kind === 'check') setArmed((active) => (active === line.id ? null : line.id));
      else onLine(line);
    },
    onPickCell: onSelectCell,
    onHoverCell: () => undefined,
    onViewChange: setSectionView,
  }), [sheet, viewing, check, onLine, onSelectCell]);

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
          </div>
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
              onArm={setArmed}
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
