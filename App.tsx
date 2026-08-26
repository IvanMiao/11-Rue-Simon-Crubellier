import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BuildingMap from './components/BuildingMap';
import NarrativePanel from './components/NarrativePanel';
import InventoryPanel from './components/InventoryPanel';
import CharacterCreate from './components/CharacterCreate';
import HudBar from './components/HudBar';
import CaseFile from './components/CaseFile';
import SkillCheckModal from './components/SkillCheckModal';
import RunEndScreen from './components/RunEndScreen';
import GeneratingCeremony from './components/GeneratingCeremony';
import {
  RoomData,
  PlayerState,
  InventoryItem,
  Interaction,
  Character,
  SkillCheckResult,
  SkillId,
  NarrativeResponse,
} from './types';
import {
  generateStoryBible,
  generateRoomDescription,
  isLanguageModelEnabled,
} from './services/geminiService';
import { describeMove, getReachableRooms } from './utils/gridLogic';
import {
  INITIAL_PLAYER_STATE,
  applyTime,
  appendJournal,
  beginRun,
  cacheRoom,
  collectItem,
  consumeInteraction,
  applyCheckToState,
  hundredthUnlocked,
  internalizeThought,
  moveTimeCost,
  skillValue,
  spendSkillPoint,
  upgradeRoom,
} from './utils/gameLogic';
import { performSkillCheck, interactionKey } from './utils/skillCheck';
import { newRunSeed } from './utils/rng';
import { BUILDING_LAYOUT } from './constants';
import { STORAGE_KEY } from './constants/skills';
import { buildingAudio } from './services/audioEngine';
import {
  moveKindForPrefetch,
  roomsToPrefetch,
  skeletonForRoom,
} from './utils/roomRuntime';

const App: React.FC = () => {
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null);
  const [isMobileMapOpen, setIsMobileMapOpen] = useState(true);
  const [isCaseOpen, setIsCaseOpen] = useState(false);
  const [gameState, setGameState] = useState<PlayerState>(INITIAL_PLAYER_STATE);
  const [isHydrated, setIsHydrated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [muted, setMuted] = useState(() => buildingAudio.isMuted());
  const [pendingCheck, setPendingCheck] = useState<{
    interaction: Interaction;
    result: SkillCheckResult;
    rolling: boolean;
  } | null>(null);
  const [generatingRoomId, setGeneratingRoomId] = useState<string | null>(null);
  const generatingRef = useRef<string | null>(null);
  const stateRef = useRef(gameState);
  const prefetchRef = useRef<Record<string, NarrativeResponse>>({});
  const prefetchingRef = useRef<Set<string>>(new Set());
  stateRef.current = gameState;

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as PlayerState;
        if (parsed.version === 3 && parsed.character && parsed.runStatus !== 'creating') {
          setGameState(parsed);
          if (parsed.currentRoomId) {
            const room = BUILDING_LAYOUT.find((r) => r.id === parsed.currentRoomId) || null;
            setSelectedRoom(room);
          }
        }
      } catch (e) {
        console.error('Failed to load saved state', e);
      }
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    }
  }, [gameState, isHydrated]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const unlock = () => {
      void buildingAudio.unlock();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (gameState.runStatus !== 'playing') {
      if (gameState.runStatus !== 'generating') buildingAudio.stopAmbient();
      return;
    }
    const room = BUILDING_LAYOUT.find((r) => r.id === gameState.currentRoomId);
    void buildingAudio.unlock();
    buildingAudio.startAmbient(room?.floor ?? 0, gameState.morale / Math.max(1, gameState.maxMorale));
  }, [gameState.runStatus, gameState.currentRoomId, gameState.morale, gameState.maxMorale]);

  const hundredth = hundredthUnlocked(gameState);
  const reachable = useMemo(
    () => getReachableRooms(gameState.currentRoomId, { hundredthUnlocked: hundredth }),
    [gameState.currentRoomId, hundredth]
  );

  const showToast = (msg: string) => setToast(msg);

  const roomContext = (state: PlayerState, moveKind: 'walk' | 'knight' | 'elevator') => ({
    historyContext: Object.entries(state.visitedRooms)
      .slice(-5)
      .map(([id, data]) => `Room ${id}: ${(data as NarrativeResponse).text} (Mood: ${(data as NarrativeResponse).mood})`)
      .join('\n\n'),
    storyBible: state.storyBible,
    inventory: state.inventory.map((i) => i.name),
    isKnightMove: moveKind === 'knight' || state.lastMoveKind === 'knight' || state.lastMoveWasKnightMove,
    moveKind,
    character: state.character,
    knownClues: state.discoveredFacts,
    plotSummary: state.plotThreads
      .filter((t) => t.status !== 'unknown')
      .map((t) => `${t.id}[${t.status}]: ${t.clues.join('; ')}`)
      .join(' / '),
    minutesPastEight: state.minutesPastEight,
    morale: state.morale,
    maxMorale: state.maxMorale,
    seed: state.runSeed,
  });

  const startRunWithCharacter = async (character: Character) => {
    const seed = newRunSeed();
    prefetchRef.current = {};
    prefetchingRef.current = new Set();
    setGameState({
      ...INITIAL_PLAYER_STATE,
      runStatus: 'generating',
      character,
      runSeed: seed,
    });
    try {
      const bible = await generateStoryBible(seed, character);
      const started = beginRun(character, seed, bible);
      setGameState(started);
      const hall = BUILDING_LAYOUT.find((r) => r.id === '0-5') || null;
      setSelectedRoom(hall);
      setIsMobileMapOpen(false);
    } catch (e) {
      console.error(e);
      showToast('故事圣经织不出来。再试一次。');
      setGameState(INITIAL_PLAYER_STATE);
    }
  };

  const handleRequestGenerate = useCallback(async (room: RoomData) => {
    const state = stateRef.current;
    const existing = state.visitedRooms[room.id];
    if (existing?.source === 'authored') return;
    if (generatingRef.current === room.id) return;

    const pref = prefetchRef.current[room.id];
    if (pref) {
      setGameState((prev) => upgradeRoom(prev, room.id, pref));
      delete prefetchRef.current[room.id];
      return;
    }

    const moveKind = state.lastMoveKind || 'walk';
    if (!existing) {
      const skeleton = skeletonForRoom(
        room,
        state.runSeed,
        state.character,
        moveKind === 'knight'
      );
      setGameState((prev) => cacheRoom(prev, room.id, skeleton));
    }

    if (!isLanguageModelEnabled) {
      setGameState((prev) => {
        const current = prev.visitedRooms[room.id];
        if (!current || current.source === 'authored') return prev;
        return upgradeRoom(prev, room.id, { ...current, source: 'authored' });
      });
      return;
    }

    generatingRef.current = room.id;
    setGeneratingRoomId(room.id);
    try {
      const content = await generateRoomDescription(room.id, room.name, roomContext(stateRef.current, moveKind));
      setGameState((prev) => upgradeRoom(prev, room.id, content));
    } finally {
      generatingRef.current = null;
      setGeneratingRoomId(null);
    }
  }, []);

  useEffect(() => {
    if (gameState.runStatus !== 'playing' || !isLanguageModelEnabled) return;
    const ids = roomsToPrefetch(reachable, gameState.currentRoomId, gameState.visitedRooms);
    ids.forEach((id) => {
      if (prefetchRef.current[id] || prefetchingRef.current.has(id)) return;
      const room = BUILDING_LAYOUT.find((r) => r.id === id);
      if (!room) return;
      prefetchingRef.current.add(id);
      const kind = moveKindForPrefetch(reachable, id);
      generateRoomDescription(room.id, room.name, roomContext(stateRef.current, kind))
        .then((content) => {
          prefetchRef.current[id] = { ...content, source: 'authored' };
        })
        .finally(() => {
          prefetchingRef.current.delete(id);
        });
    });
  }, [gameState.currentRoomId, gameState.runStatus, reachable, gameState.visitedRooms]);

  const handleRoomSelect = (room: RoomData) => {
    if (gameState.runStatus !== 'playing') return;
    const move = describeMove(reachable, room.id);
    if (move === 'blocked' && room.id !== gameState.currentRoomId) {
      buildingAudio.blocked();
      showToast('走不到。试试相邻的走廊，或者那步骑士跳。');
      return;
    }
    if (room.id !== gameState.currentRoomId) {
      const kind = move === 'blocked' ? 'walk' : move;
      if (kind === 'knight') buildingAudio.knight();
      else if (kind === 'elevator') buildingAudio.elevator();
      else buildingAudio.walk();
      const cost = moveTimeCost(kind);
      setGameState((prev) => ({
        ...applyTime(prev, cost),
        currentRoomId: room.id,
        lastMoveWasKnightMove: kind === 'knight',
        lastMoveWasWalk: kind === 'walk',
        lastMoveKind: kind,
      }));
    }
    setSelectedRoom(room);
    if (window.innerWidth < 768) setIsMobileMapOpen(false);
  };

  const handleBlocked = (room: RoomData) => {
    buildingAudio.blocked();
    showToast(`${room.name || '那个格子'}现在走不到。骑士跳会发光。`);
  };

  const handleCollectItem = (item: InventoryItem) => {
    setGameState((prev) => {
      if (!selectedRoom) return collectItem(prev, item);
      const room = prev.visitedRooms[selectedRoom.id];
      const collected = collectItem(prev, item);
      if (!room) return collected;
      return {
        ...collected,
        visitedRooms: {
          ...collected.visitedRooms,
          [selectedRoom.id]: { ...room, collectible_item: undefined, collectible_taken: true },
        },
      };
    });
    showToast(item.type === 'puzzle_piece' ? `拼图片：${item.name}` : `收下：${item.name}`);
  };

  const handleInteract = (interaction: Interaction) => {
    if (!selectedRoom || gameState.runStatus !== 'playing') return;
    const id = interaction.id || interaction.label;
    const key = interactionKey(selectedRoom.id, id);

    if (interaction.skill && interaction.difficulty) {
      if (interaction.kind === 'red' && gameState.attemptedRedChecks.includes(key)) return;
      if (gameState.resolvedChecks[key] === true) return;

      const result = performSkillCheck({
        skill: interaction.skill,
        skillValue: skillValue(gameState, interaction.skill),
        difficulty: interaction.difficulty,
        kind: interaction.kind,
        seed: gameState.runSeed,
        salt: `${key}:${gameState.checkLog.length}:${gameState.minutesPastEight}`,
      });
      setPendingCheck({ interaction: { ...interaction, id }, result, rolling: true });
      window.setTimeout(() => {
        setPendingCheck((curr) => (curr ? { ...curr, rolling: false } : curr));
      }, 900);
      return;
    }

    const text = interaction.response;
    setGameState((prev) =>
      consumeInteraction(
        appendJournal(applyTime(prev, 5), selectedRoom.id, `> ${interaction.label}\n${text}`),
        selectedRoom.id,
        id
      )
    );
  };

  const finishPendingCheck = () => {
    if (!pendingCheck || !selectedRoom) return;
    const { interaction, result } = pendingCheck;
    const id = interaction.id || interaction.label;
    const body = result.success
      ? interaction.success_response || interaction.response
      : interaction.failure_response || '什么也没有发生，只是你自己出了丑。';
    const header = `${result.success ? '成功' : '失败'} · ${interaction.label}`;
    setGameState((prev) =>
      appendJournal(
        applyCheckToState(prev, selectedRoom.id, id, interaction.label, result, {
          clue: interaction.clue,
          plot_flag: interaction.plot_flag,
          morale_on_success: interaction.morale_on_success,
          morale_on_fail: interaction.morale_on_fail,
          resolves_mystery: interaction.resolves_mystery,
        }),
        selectedRoom.id,
        `> ${header}\n${body}`
      )
    );
    setPendingCheck(null);
    if (result.success && interaction.resolves_mystery) {
      showToast('拼图合上了。');
    } else if (!result.success) {
      buildingAudio.moraleDrain();
      showToast('检定失败。意志被削去一角。');
    }
  };

  const handleReset = () => {
    if (gameState.runStatus === 'playing') {
      if (!window.confirm('放弃这一局？种子、案卷和意志都会消失。')) return;
    }
    buildingAudio.stopAmbient();
    localStorage.removeItem(STORAGE_KEY);
    prefetchRef.current = {};
    setGameState(INITIAL_PLAYER_STATE);
    setSelectedRoom(null);
    setIsMobileMapOpen(true);
    setIsCaseOpen(false);
  };

  const visitedIds = useMemo(
    () => new Set(Object.keys(gameState.visitedRooms)),
    [gameState.visitedRooms]
  );

  const disabledChecks = useMemo(() => {
    if (!selectedRoom) return new Set<string>();
    const set = new Set<string>();
    const room = gameState.visitedRooms[selectedRoom.id];
    room?.available_interactions?.forEach((it) => {
      const id = it.id || it.label;
      const key = interactionKey(selectedRoom.id, id);
      if (gameState.resolvedChecks[key] === true) set.add(id);
      if (it.kind === 'red' && gameState.attemptedRedChecks.includes(key)) set.add(id);
    });
    return set;
  }, [gameState, selectedRoom]);

  if (!isHydrated) {
    return <div className="h-screen w-screen bg-[#eae7dc]" />;
  }

  if (gameState.runStatus === 'creating') {
    return <CharacterCreate onBegin={startRunWithCharacter} />;
  }

  if (gameState.runStatus === 'generating') {
    return <GeneratingCeremony seed={gameState.runSeed} character={gameState.character} />;
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-stone-50 text-stone-900">
      <div className="paper-grain" />
      <div className="vignette" />
      <HudBar
        state={gameState}
        muted={muted}
        onToggleMute={() => {
          const next = buildingAudio.toggleMuted();
          setMuted(next);
        }}
        onOpenCase={() => {
          buildingAudio.ui();
          setIsCaseOpen(true);
        }}
        onOpenSheet={() => {
          buildingAudio.ui();
          setIsCaseOpen(true);
        }}
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
            puzzlePiecesCollected={gameState.puzzlePiecesCollected}
            lastMoveKind={gameState.lastMoveKind}
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
              onRequestGenerate={handleRequestGenerate}
              generating={generatingRoomId === selectedRoom?.id}
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
        onInternalize={(id) => {
          buildingAudio.ui();
          setGameState((prev) => internalizeThought(prev, id));
          showToast('念头住进来了。时间少了二十分钟。');
        }}
        onSpendPoint={(skill: SkillId) => setGameState((prev) => spendSkillPoint(prev, skill))}
      />

      <SkillCheckModal
        open={!!pendingCheck}
        label={pendingCheck?.interaction.label || ''}
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
