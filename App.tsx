import React, { useState, useEffect, useMemo } from 'react';
import BuildingMap from './components/BuildingMap';
import NarrativePanel from './components/NarrativePanel';
import StoryBibleViewer from './components/StoryBibleViewer';
import InventoryPanel from './components/InventoryPanel';
import { RoomData, NarrativeResponse, StoryBible, PlayerState, InventoryItem } from './types';
import { generateStoryBible, generateRoomDescription } from './services/geminiService';
import { getValidKnightMoves } from './utils/gridLogic';

const API_KEY_STATUS = process.env.API_KEY ? 'Connected' : 'Missing API Key';
const STORAGE_KEY = 'perec_app_state_v2';

const INITIAL_STATE: PlayerState = {
  visitedRooms: {},
  inventory: [],
  puzzlePiecesCollected: 0,
  lastMoveWasKnightMove: false
};

const App: React.FC = () => {
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null);
  const [isMobileMapOpen, setIsMobileMapOpen] = useState(true);
  const [isBibleOpen, setIsBibleOpen] = useState(false);

  // Game State: Stores content for visited rooms
  const [gameState, setGameState] = useState<PlayerState>(INITIAL_STATE);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isGeneratingBible, setIsGeneratingBible] = useState(false);

  // Load state on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setGameState(parsed);
        if (!parsed.storyBible) {
          // If we have state but no bible (migration), generate one
          initStoryBible(parsed);
        } else {
          setIsInitialized(true);
        }
      } catch (e) {
        console.error("Failed to load saved state", e);
        initStoryBible(INITIAL_STATE);
      }
    } else {
      initStoryBible(INITIAL_STATE);
    }
  }, []);

  const initStoryBible = async (currentGameState: PlayerState) => {
    setIsGeneratingBible(true);
    try {
      const bible = await generateStoryBible();
      setGameState({ ...currentGameState, storyBible: bible });
    } catch (e) {
      console.error("Failed to generate bible", e);
    } finally {
      setIsGeneratingBible(false);
      setIsInitialized(true);
    }
  };

  // Save state on change
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    }
  }, [gameState, isInitialized]);

  const validKnightMoves = useMemo(() => {
    if (!selectedRoom) return new Set<string>();
    return new Set(getValidKnightMoves(selectedRoom.id));
  }, [selectedRoom]);

  const handleRoomSelect = (room: RoomData) => {
    // Check if this is a Knight's move from the current room
    const isKnightMove = selectedRoom ? validKnightMoves.has(room.id) : false;

    // Update state to track the move type for the NEXT generation
    setGameState(prev => ({
      ...prev,
      lastMoveWasKnightMove: isKnightMove
    }));

    setSelectedRoom(room);
    if (window.innerWidth < 768) {
      setIsMobileMapOpen(false);
    }
  };

  const toggleMobileView = () => {
    setIsMobileMapOpen(!isMobileMapOpen);
  };

  // Callback when NarrativePanel generates new content
  // Callback when NarrativePanel generates new content
  const handleContentGenerated = (roomId: string, content: NarrativeResponse) => {
    setGameState(prev => {
      const newState = {
        ...prev,
        visitedRooms: {
          ...prev.visitedRooms,
          [roomId]: content
        }
      };
      return newState;
    });
  };

  const handleCollectItem = (item: InventoryItem) => {
    setGameState(prev => {
      // Avoid duplicates
      if (prev.inventory.some(i => i.id === item.id)) return prev;

      const isPuzzlePiece = item.type === 'puzzle_piece';
      const newPuzzleCount = isPuzzlePiece ? prev.puzzlePiecesCollected + 1 : prev.puzzlePiecesCollected;

      return {
        ...prev,
        inventory: [...prev.inventory, item],
        puzzlePiecesCollected: newPuzzleCount
      };
    });

    if (item.type === 'puzzle_piece') {
      alert(`PUZZLE PIECE FOUND: ${item.name}\n\n"This feels significant..."`);
    } else {
      alert(`You collected: ${item.name}`);
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to erase all memories of the building? This cannot be undone.")) {
      localStorage.removeItem(STORAGE_KEY);
      setGameState(INITIAL_STATE);
      setSelectedRoom(null);
      setIsMobileMapOpen(true);
      setIsInitialized(false);
      initStoryBible(INITIAL_STATE);
    }
  };

  // Build a context string from previously visited rooms (last 5 to provide continuity)
  const historyContext = useMemo(() => {
    const entries = Object.entries(gameState.visitedRooms);
    // Take the last 5 visited roughly
    const contextItems = entries.slice(-5).map(([id, data]) => {
      const roomData = data as NarrativeResponse;
      // User requested full text context. 
      // Format: "Room [ID]: [Full Description] (Mood: [Mood])"
      return `Room (ID ${id}): ${roomData.text} (Mood: ${roomData.mood})`;
    });
    return contextItems.join("\n\n");
  }, [gameState.visitedRooms]);

  // Set of visited IDs for the map
  const visitedIds = useMemo(() => new Set(Object.keys(gameState.visitedRooms)), [gameState.visitedRooms]);

  if (!isInitialized || isGeneratingBible) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#eae7dc] text-stone-800 font-typewriter">
        <div className="w-16 h-16 border-4 border-stone-800 border-t-transparent rounded-full animate-spin mb-8"></div>
        <h2 className="text-xl uppercase tracking-widest mb-2">Constructing Building History</h2>
        <p className="text-sm text-stone-500 animate-pulse">Weaving themes, secrets, and shadows...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-stone-50 text-stone-900">
      {/* Navigation Bar */}
      <nav className="h-14 flex items-center justify-between px-4 bg-white border-b border-stone-300 z-30 shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="font-serif font-bold text-lg hidden md:inline">La Vie mode d'emploi</span>
          <span className="font-serif font-bold text-lg md:hidden">La Vie...</span>
          <span className="text-xs font-typewriter text-stone-400 border border-stone-200 px-1 rounded">10x10 GRID</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Archives Button */}
          <button
            onClick={() => setIsBibleOpen(true)}
            className="font-typewriter text-xs px-3 py-1 border border-stone-400 rounded hover:bg-stone-100 text-stone-600 uppercase tracking-wider"
          >
            Archives
          </button>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="font-typewriter text-xs text-red-800 hover:text-red-600 hover:underline uppercase"
            title="Reset all progress"
          >
            Reset Story
          </button>

          <button
            onClick={toggleMobileView}
            className="md:hidden font-typewriter text-xs px-3 py-1 border border-stone-800 rounded hover:bg-stone-800 hover:text-white transition"
          >
            {isMobileMapOpen ? 'READ' : 'MAP'}
          </button>
        </div>
      </nav>

      {/* Main Split View */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Left Panel: Map */}
        <div className={`
          absolute inset-0 md:relative md:w-1/2 lg:w-5/12 xl:w-1/2 z-10
          transition-transform duration-500 ease-in-out bg-[#eae7dc]
          ${isMobileMapOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <BuildingMap
            onRoomSelect={handleRoomSelect}
            selectedRoomId={selectedRoom?.id || null}
            visitedRoomIds={visitedIds}
            validKnightMoves={validKnightMoves}
            puzzlePiecesCollected={gameState.puzzlePiecesCollected}
          />
        </div>

        {/* Right Panel: Narrative & Inventory */}
        <div className={`
            absolute inset-0 md:relative md:w-1/2 lg:w-7/12 xl:w-1/2 z-0 bg-[#fdfbf7]
            transition-transform duration-500 ease-in-out flex flex-col
            ${!isMobileMapOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          `}>
          <div className="flex-1 overflow-hidden relative">
            <NarrativePanel
              selectedRoom={selectedRoom}
              cachedContent={selectedRoom ? gameState.visitedRooms[selectedRoom.id] : undefined}
              onContentGenerated={handleContentGenerated}
              historyContext={historyContext}
              storyBible={gameState.storyBible}
              inventory={gameState.inventory.map(i => i.name)}
              isKnightMove={gameState.lastMoveWasKnightMove}
              onCollectItem={handleCollectItem}
            />
          </div>

          {/* Inventory Panel (Fixed at bottom of right panel) */}
          <div className="z-20 shrink-0">
            <InventoryPanel items={gameState.inventory} />
          </div>
        </div>

      </div>

      {/* Story Bible Viewer Modal */}
      <StoryBibleViewer
        isOpen={isBibleOpen}
        onClose={() => setIsBibleOpen(false)}
        bible={gameState.storyBible}
      />
    </div>
  );
};

export default App;