import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CaseGraph } from '../../case/types';
import type { Action, GameEvent } from '../../engine/types';
import type { PlayerState } from '../../types';
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
import DamierCanvas, { type Hour, type MoveTarget } from './DamierCanvas';
import RoomPage, { type PendingLineCheck } from './RoomPage';
import Notebook, { type Arrival } from './Notebook';

interface WorldScreenProps {
  state: PlayerState;
  graph: CaseGraph | null;
  generatingCellIds: ReadonlySet<string>;
  dispatch: (action: Action) => GameEvent[];
  onOpenCase: () => void;
  onReset: () => void;
}

const VIA_TEXT = { look: '观察', check: '检定', checkFail: '检定失败', recipe: '联想' } as const;

function hourOf(minutes: number): Hour {
  return Math.min(23, 20 + Math.floor(Math.max(0, minutes) / 60)) as Hour;
}

function footnoteFor(state: PlayerState, cardId: string) {
  const source = cardProvenance(state, cardId);
  if (!source) return '';
  const chapter = source.chapter ? `第 ${chapterNumeral(source.chapter)} 章` : '';
  return [chapter, source.title, VIA_TEXT[source.via]].filter(Boolean).join(' · ');
}

/** The play screen: Valène's canvas on the desk, the open chapter page, and the sketchbook. */
const WorldScreen: React.FC<WorldScreenProps> = ({ state: liveState, graph, generatingCellIds, dispatch, onOpenCase, onReset }) => {
  const [frozen, setFrozen] = useState<PlayerState | null>(null);
  const [pending, setPending] = useState<{ before: PlayerState; events: GameEvent[] } | null>(null);
  const [check, setCheck] = useState<PendingLineCheck | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [caption, setCaption] = useState<{ title: string; text: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [notebookNew, setNotebookNew] = useState(false);
  const arrivalSeq = useRef(0);

  const state = frozen || liveState;
  const current = state.currentRoomId;
  const shownCell = viewing && state.visitedRooms[viewing] ? viewing : current;

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
      if (events) lastEvents.current = events;
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

      <main className="flex-1 min-h-0 grid md:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] gap-5 px-4 md:px-6 pb-4">
        <div className="min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="h-full max-h-full aspect-[10.5/11.4] max-w-full">
              <DamierCanvas
                cells={CELLS}
                visited={visited}
                clinamenId={CLINAMEN_CELL}
                hour={hourOf(state.minutesPastEight)}
                current={current}
                lamps={lamps}
                changed={changed}
                targets={targets}
                selected={viewing}
                onSelect={onSelectCell}
                titleFor={(id) => {
                  const cell = CELL_BY_ID[id];
                  const t = targets[id];
                  const head = cell?.chapter ? `第 ${chapterNumeral(cell.chapter)} 章 · ` : '';
                  return `${head}${cellTitle(id)}${t ? ` · ${t.kind === 'knight' ? '骑士跳' : t.kind === 'elevator' ? '电梯' : '走过去'} ${t.minutes} 分钟` : ''}`;
                }}
                caption={caption}
                className="paper-sheet"
              />
            </div>
          </div>
          <div className="pt-3 flex items-end gap-4">
            <Notebook
              owned={Boolean(state.case?.notebook)}
              justFound={notebookNew}
              cards={state.case?.cards.length || 0}
              locked={state.case?.lockedGroups.length || 0}
              graph={graph}
              arrivals={arrivals}
              onOpen={onOpenCase}
            />
            <span className="world-caption !text-left hidden lg:block">
              金色纸签 = 骑士跳 · 白色纸签 = 走过去 · 亮灯 = 这一格还有东西可看
            </span>
          </div>
        </div>

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
