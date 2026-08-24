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
  RoomData,
  PlayerState,
  InventoryItem,
  Interaction,
  Character,
  SkillCheckResult,
  SkillId,
  NarrativeResponse,
} from './types';
import { generateStoryBible, generateRoomDescription } from './services/geminiService';
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
} from './utils/gameLogic';
import { performSkillCheck, interactionKey } from './utils/skillCheck';
import { newRunSeed } from './utils/rng';
import { BUILDING_LAYOUT } from './constants';
import { STORAGE_KEY } from './constants/skills';

const App: React.FC = () => {
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null);
  const [isMobileMapOpen, setIsMobileMapOpen] = useState(true);
  const [isCaseOpen, setIsCaseOpen] = useState(false);
  const [gameState, setGameState] = useState<PlayerState>(INITIAL_PLAYER_STATE);
  const [isHydrated, setIsHydrated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingCheck, setPendingCheck] = useState<{
    interaction: Interaction;
    result: SkillCheckResult;
    rolling: boolean;
  } | null>(null);
  const [generatingRoomId, setGeneratingRoomId] = useState<string | null>(null);
  const generatingRef = useRef<string | null>(null);

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

  const hundredth = hundredthUnlocked(gameState);
  const reachable = useMemo(
    () => getReachableRooms(gameState.currentRoomId, { hundredthUnlocked: hundredth }),
    [gameState.currentRoomId, hundredth]
  );

  const showToast = (msg: string) => setToast(msg);

  const startRunWithCharacter = async (character: Character) => {
    const seed = newRunSeed();
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

  const handleRequestGenerate = useCallback(
    async (room: RoomData) => {
      if (gameState.visitedRooms[room.id] || generatingRoomId || generatingRef.current === room.id) return;
      generatingRef.current = room.id;
      setGeneratingRoomId(room.id);
      try {
        const content = await generateRoomDescription(room.id, room.name, {
          historyContext: Object.entries(gameState.visitedRooms)
            .slice(-5)
            .map(([id, data]) => `Room ${id}: ${(data as NarrativeResponse).text} (Mood: ${(data as NarrativeResponse).mood})`)
            .join('\n\n'),
          storyBible: gameState.storyBible,
          inventory: gameState.inventory.map((i) => i.name),
          isKnightMove: gameState.lastMoveKind === 'knight' || gameState.lastMoveWasKnightMove,
          moveKind: gameState.lastMoveKind,
          character: gameState.character,
          knownClues: gameState.discoveredFacts,
          plotSummary: gameState.plotThreads
            .filter((t) => t.status !== 'unknown')
            .map((t) => `${t.id}[${t.status}]: ${t.clues.join('; ')}`)
            .join(' / '),
          minutesPastEight: gameState.minutesPastEight,
          morale: gameState.morale,
          maxMorale: gameState.maxMorale,
          seed: gameState.runSeed,
        });
        setGameState((prev) => cacheRoom(prev, room.id, content));
      } finally {
        generatingRef.current = null;
        setGeneratingRoomId(null);
      }
    },
    [gameState, generatingRoomId]
  );

  const handleRoomSelect = (room: RoomData) => {
    if (gameState.runStatus !== 'playing') return;
    const move = describeMove(reachable, room.id);
    if (move === 'blocked' && room.id !== gameState.currentRoomId) {
      showToast('走不到。试试相邻的走廊，或者那步骑士跳。');
      return;
    }
    if (room.id !== gameState.currentRoomId) {
      const cost = moveTimeCost(move === 'blocked' ? 'walk' : move);
      setGameState((prev) => ({
        ...applyTime(prev, cost),
        currentRoomId: room.id,
        lastMoveWasKnightMove: move === 'knight',
        lastMoveWasWalk: move === 'walk',
        lastMoveKind: move === 'blocked' ? 'walk' : move,
      }));
    }
    setSelectedRoom(room);
    if (window.innerWidth < 768) setIsMobileMapOpen(false);
  };

  const handleBlocked = (room: RoomData) => {
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
          [selectedRoom.id]: { ...room, collectible_item: undefined },
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
      showToast('检定失败。意志被削去一角。');
    }
  };

  const handleReset = () => {
    if (gameState.runStatus === 'playing') {
      if (!window.confirm('放弃这一局？种子、案卷和意志都会消失。')) return;
    }
    localStorage.removeItem(STORAGE_KEY);
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
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#eae7dc] text-stone-800 font-typewriter">
        <div className="w-16 h-16 border-4 border-stone-800 border-t-transparent rounded-full animate-spin mb-8"></div>
        <h2 className="text-xl uppercase tracking-widest mb-2">为这一局编织圣经</h2>
        <p className="text-sm text-stone-500 animate-pulse">种子会决定谁在说谎，哪一块拼图缺席。</p>
      </div>
    );
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
            puzzlePiecesCollected={gameState.puzzlePiecesCollected}
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
