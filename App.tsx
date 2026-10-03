import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BuildingMap from './components/BuildingMap';
import NarrativePanel from './components/NarrativePanel';
import InventoryPanel from './components/InventoryPanel';
import CharacterCreate from './components/CharacterCreate';
import HudBar from './components/HudBar';
import CaseFile from './components/CaseFile';
import SkillCheckModal from './components/SkillCheckModal';
import RunEndScreen from './components/RunEndScreen';
import {
  Character,
  Interaction,
  NarrativeResponse,
  PlayerState,
  RoomData,
  SkillCheckResult,
  SkillId,
} from './types';
import { generateRoomDescription } from './services/geminiService';
import { describeMove, getReachableRooms } from './utils/gridLogic';
import { hundredthUnlocked } from './utils/gameLogic';
import { fallbackRoom } from './utils/fallbackContent';
import { newRunSeed } from './utils/rng';
import { BUILDING_LAYOUT } from './constants';
import { Action, GameEvent } from './engine/types';
import { useGameEngine } from './engine/useGameEngine';
import { buildCase, caseBible } from './case/buildCase';
import { isInteractionAvailable, roomsWithAvailableEvidence } from './engine/step';

interface PendingCheck {
  label: string;
  result: SkillCheckResult;
  roomId: string;
  before: PlayerState;
  events: GameEvent[];
  rolling: boolean;
}

const App: React.FC = () => {
  const {
    state: engineState,
    isHydrated,
    dispatch,
    reset,
    getState,
  } = useGameEngine();
  const [isMobileMapOpen, setIsMobileMapOpen] = useState(true);
  const [isCaseOpen, setIsCaseOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingCheck, setPendingCheck] = useState<PendingCheck | null>(null);
  const [generatingRoomIds, setGeneratingRoomIds] = useState<Set<string>>(new Set());
  const generatingRef = useRef(new Set<string>());

  const gameState = pendingCheck?.before || engineState;
  const selectedRoom = useMemo(
    () => BUILDING_LAYOUT.find((room) => room.id === gameState.currentRoomId) || null,
    [gameState.currentRoomId]
  );
  const caseGraph = useMemo(
    () => (gameState.case ? buildCase(gameState.runSeed) : null),
    [gameState.runSeed, gameState.case?.liar]
  );
  const caseEvidenceRoomIds = useMemo(
    () => roomsWithAvailableEvidence(gameState),
    [gameState.runSeed, gameState.runStatus, gameState.case, gameState.attemptedRedChecks]
  );

  const showToast = useCallback((message: string) => setToast(message), []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  const reachable = useMemo(
    () =>
      getReachableRooms(gameState.currentRoomId, {
        hundredthUnlocked: hundredthUnlocked(gameState),
      }),
    [gameState.currentRoomId, gameState.case?.lockedGroups.length]
  );

  const requestRoomContent = useCallback(
    async (roomId: string) => {
      if (generatingRef.current.has(roomId)) return;
      const current = getState();
      const room = BUILDING_LAYOUT.find((candidate) => candidate.id === roomId);
      if (!room || current.visitedRooms[roomId] || !current.character || current.runStatus !== 'playing') {
        return;
      }

      generatingRef.current.add(roomId);
      setGeneratingRoomIds((previous) => new Set(previous).add(roomId));
      let content: NarrativeResponse;
      try {
        content = await generateRoomDescription(room.id, room.name, {
          historyContext: Object.entries(current.visitedRooms)
            .slice(-5)
            .map(
              ([id, data]) =>
                `Room ${id}: ${(data as NarrativeResponse).text} (Mood: ${(data as NarrativeResponse).mood})`
            )
            .join('\n\n'),
          storyBible: current.storyBible,
          inventory: current.inventory.map((item) => item.name),
          isKnightMove: current.lastMoveKind === 'knight' || current.lastMoveWasKnightMove,
          moveKind: current.lastMoveKind,
          character: current.character,
          knownClues: current.discoveredFacts,
          plotSummary: current.plotThreads
            .filter((thread) => thread.status !== 'unknown')
            .map((thread) => `${thread.id}[${thread.status}]: ${thread.clues.join('; ')}`)
            .join(' / '),
          minutesPastEight: current.minutesPastEight,
          morale: current.morale,
          maxMorale: current.maxMorale,
          seed: current.runSeed,
        });
      } catch (error) {
        console.error(error);
        content = fallbackRoom(
          room.id,
          room.name,
          current.runSeed,
          current.character,
          current.lastMoveKind === 'knight'
        );
      }

      const latest = getState();
      if (
        latest.runSeed === current.runSeed &&
        latest.character &&
        latest.runStatus === 'playing'
      ) {
        dispatch({ type: 'roomContent', roomId, content });
      }
      generatingRef.current.delete(roomId);
      setGeneratingRoomIds((previous) => {
        const next = new Set(previous);
        next.delete(roomId);
        return next;
      });
    },
    [dispatch, getState]
  );

  const toastForEvents = useCallback(
    (events: GameEvent[]) => {
      const rejected = events.find((event) => event.type === 'rejected');
      if (rejected?.type === 'rejected') {
        showToast(rejected.reason);
        return;
      }
      const ending = events.find((event) => event.type === 'runEnded');
      if (ending?.type === 'runEnded') {
        showToast(
          ending.status === 'solved'
            ? '拼图合上了。'
            : ending.status === 'midnight'
              ? '午夜到了。'
              : '意志崩解了。'
        );
        return;
      }
      const groupLocked = events.find((event) => event.type === 'groupLocked');
      if (groupLocked?.type === 'groupLocked') {
        showToast('这一组对上了。');
        return;
      }
      const groupRejected = events.find((event) => event.type === 'groupRejected');
      if (groupRejected?.type === 'groupRejected') {
        showToast('对不上。至少有一格错了。意志 −1');
        return;
      }
      const combined = events.find((event) => event.type === 'combined');
      if (combined?.type === 'combined') {
        const graph = buildCase(getState().runSeed);
        const recipe = graph.recipes.find((candidate) => candidate.id === combined.recipeId);
        const labels =
          recipe?.cards
            .map((cardId) => graph.cards.find((card) => card.id === cardId)?.label)
            .filter((label): label is string => Boolean(label)) || [];
        showToast(labels.length ? `联想：${labels.join('、')}` : '什么也没联想到。');
        return;
      }
      const cardsFound = events.find((event) => event.type === 'cardsFound');
      if (cardsFound?.type === 'cardsFound') {
        const graph = buildCase(getState().runSeed);
        const labels = cardsFound.cards
          .map((cardId) => graph.cards.find((card) => card.id === cardId)?.label)
          .filter((label): label is string => Boolean(label));
        showToast(`新词卡：${labels.join('、')}`);
        return;
      }
      const check = events.find((event) => event.type === 'checkRolled');
      if (check?.type === 'checkRolled') {
        showToast(
          !check.result.success
              ? '检定失败。意志被削去一角。'
              : events.some((event) => event.type === 'clueFound')
                ? '新线索已收入案卷。'
                : '检定成功。'
        );
        return;
      }
      const item = events.find((event) => event.type === 'itemCollected');
      if (item?.type === 'itemCollected') {
        showToast(
          item.item.type === 'puzzle_piece'
            ? `拼图片：${item.item.name}`
            : `收下：${item.item.name}`
        );
        return;
      }
      if (events.some((event) => event.type === 'thoughtInternalized')) {
        showToast('念头住进来了。时间少了二十分钟。');
      }
    },
    [getState, showToast]
  );

  const dispatchAction = useCallback(
    (action: Action) => {
      const before = getState();
      const events = dispatch(action);
      const rolledCheck = events.find((event) => event.type === 'checkRolled');
      if (rolledCheck?.type === 'checkRolled') {
        setPendingCheck({
          label: rolledCheck.label,
          result: rolledCheck.result,
          roomId: rolledCheck.roomId,
          before,
          events,
          rolling: true,
        });
        window.setTimeout(
          () => setPendingCheck((current) => (current ? { ...current, rolling: false } : current)),
          900
        );
      } else {
        toastForEvents(events);
      }
      events.forEach((event) => {
        if (event.type === 'needsRoomContent') void requestRoomContent(event.roomId);
      });
      return events;
    },
    [dispatch, getState, requestRoomContent, toastForEvents]
  );

  useEffect(() => {
    const currentRoomId = engineState.currentRoomId;
    if (
      engineState.runStatus === 'playing' &&
      currentRoomId &&
      !engineState.visitedRooms[currentRoomId]
    ) {
      void requestRoomContent(currentRoomId);
    }
  }, [engineState.currentRoomId, engineState.runStatus, engineState.visitedRooms, requestRoomContent]);

  const startRunWithCharacter = (character: Character) => {
    const seed = newRunSeed();
    const bible = caseBible(buildCase(seed));
    dispatchAction({ type: 'startRun', character, seed, bible });
    setIsMobileMapOpen(false);
  };

  const handleRoomSelect = (room: RoomData) => {
    if (gameState.runStatus !== 'playing') return;
    const move = describeMove(reachable, room.id);
    if (move === 'blocked' && room.id !== gameState.currentRoomId) {
      showToast('走不到。试试相邻的走廊，或者那步骑士跳。');
      return;
    }
    if (room.id !== gameState.currentRoomId) {
      dispatchAction({ type: 'move', roomId: room.id });
    }
    if (window.innerWidth < 768) setIsMobileMapOpen(false);
  };

  const handleBlocked = (room: RoomData) => {
    showToast(`${room.name || '那个格子'}现在走不到。骑士跳会发光。`);
  };

  const handleCollectItem = (item: { id: string }) => {
    dispatchAction({ type: 'collect', itemId: item.id });
  };

  const handleInteract = (interaction: Interaction) => {
    if (!interaction.id) return;
    dispatchAction({ type: 'interact', interactionId: interaction.id });
  };

  const finishPendingCheck = () => {
    if (!pendingCheck) return;
    const events = pendingCheck.events;
    setPendingCheck(null);
    toastForEvents(events);
  };

  const handleReset = () => {
    if (engineState.runStatus === 'playing') {
      if (!window.confirm('放弃这一局？种子、案卷和意志都会消失。')) return;
    }
    reset();
    generatingRef.current.clear();
    setGeneratingRoomIds(new Set());
    setIsMobileMapOpen(true);
    setIsCaseOpen(false);
    setPendingCheck(null);
  };

  const visitedIds = useMemo(
    () => new Set(Object.keys(gameState.visitedRooms)),
    [gameState.visitedRooms]
  );

  const disabledChecks = useMemo(() => {
    if (!selectedRoom) return new Set<string>();
    const disabled = new Set<string>();
    const room = gameState.visitedRooms[selectedRoom.id];
    room?.available_interactions?.forEach((interaction) => {
      const id = interaction.id || interaction.label;
      if (!isInteractionAvailable(gameState, id)) disabled.add(id);
    });
    return disabled;
  }, [gameState, selectedRoom]);

  if (!isHydrated) {
    return <div className="h-screen w-screen bg-[#eae7dc]" />;
  }

  if (engineState.runStatus === 'creating') {
    return <CharacterCreate onBegin={startRunWithCharacter} />;
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-stone-50 text-stone-900">
      <HudBar
        state={gameState}
        onOpenCase={() => setIsCaseOpen(true)}
        onOpenSheet={() => setIsCaseOpen(true)}
        onReset={handleReset}
        onToggleMap={() => setIsMobileMapOpen(!isMobileMapOpen)}
        isMobileMapOpen={isMobileMapOpen}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <div
          className={`
          absolute inset-0 md:relative md:w-1/2 lg:w-5/12 xl:w-1/2 z-10
          transition-transform duration-500 ease-in-out bg-[#eae7dc]
          ${isMobileMapOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        >
          <BuildingMap
            onRoomSelect={handleRoomSelect}
            selectedRoomId={selectedRoom?.id || gameState.currentRoomId}
            visitedRoomIds={visitedIds}
            reachable={reachable}
            caseEvidenceRoomIds={caseEvidenceRoomIds}
            onBlocked={handleBlocked}
          />
        </div>

        <div
          className={`
            absolute inset-0 md:relative md:w-1/2 lg:w-7/12 xl:w-1/2 z-0 bg-[#fdfbf7]
            transition-transform duration-500 ease-in-out flex flex-col
            ${!isMobileMapOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          `}
        >
          <div className="flex-1 overflow-hidden relative">
            <NarrativePanel
              selectedRoom={selectedRoom}
              cachedContent={selectedRoom ? gameState.visitedRooms[selectedRoom.id] : undefined}
              onRequestGenerate={(room) => void requestRoomContent(room.id)}
              generating={selectedRoom ? generatingRoomIds.has(selectedRoom.id) : false}
              onInteract={handleInteract}
              onCollectItem={handleCollectItem}
              disabledChecks={disabledChecks}
            />
          </div>
          <div className="z-20 shrink-0">
            <InventoryPanel items={gameState.inventory} />
          </div>
        </div>
      </div>

      <CaseFile
        isOpen={isCaseOpen}
        onClose={() => setIsCaseOpen(false)}
        state={gameState}
        caseGraph={caseGraph}
        onInternalize={(thoughtId) => dispatchAction({ type: 'internalize', thoughtId })}
        onSpendPoint={(skill: SkillId) => dispatchAction({ type: 'spendPoint', skill })}
        onPlaceCard={(slotId, cardId) => dispatchAction({ type: 'placeCard', slotId, cardId })}
        onCombine={(a, b) => dispatchAction({ type: 'combine', a, b })}
        onSubmitGroup={(groupId) => dispatchAction({ type: 'submitGroup', groupId })}
      />

      <SkillCheckModal
        open={!!pendingCheck}
        label={pendingCheck?.label || ''}
        result={pendingCheck?.result || null}
        rolling={pendingCheck?.rolling || false}
        onFinished={finishPendingCheck}
      />

      <RunEndScreen state={gameState} onAgain={handleReset} />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-[#f4f1ea] px-4 py-2 font-typewriter text-xs uppercase tracking-widest shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
};

export default App;
