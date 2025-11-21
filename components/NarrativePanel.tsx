import React, { useEffect, useState, useRef } from 'react';
import { RoomData, NarrativeResponse, StoryBible, InventoryItem } from '../types';
import { generateRoomDescription, inspectItem } from '../services/geminiService';

interface NarrativePanelProps {
  selectedRoom: RoomData | null;
  cachedContent?: NarrativeResponse;
  onContentGenerated: (roomId: string, content: NarrativeResponse) => void;
  historyContext: string;
  storyBible?: StoryBible;
  inventory?: string[];
  isKnightMove?: boolean;
  onCollectItem?: (item: InventoryItem) => void;
}

const NarrativePanel: React.FC<NarrativePanelProps> = ({
  selectedRoom,
  cachedContent,
  onContentGenerated,
  historyContext,
  storyBible,
  inventory,
  isKnightMove,
  onCollectItem
}) => {
  const [loading, setLoading] = useState(false);
  const [inspectedItem, setInspectedItem] = useState<{ name: string, desc: string } | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Main logic: Decide whether to use cache or fetch
  useEffect(() => {
    if (selectedRoom) {
      setInspectedItem(null);

      if (cachedContent) {
        // We have data, no need to fetch
        setLoading(false);
      } else {
        // No data, fetch new
        setLoading(true);
        setLoading(true);
        generateRoomDescription(selectedRoom.id, selectedRoom.name, historyContext, storyBible, inventory, isKnightMove)
          .then((data) => {
            onContentGenerated(selectedRoom.id, data);
            setLoading(false);
          })
          .catch((err) => {
            console.error(err);
            setLoading(false);
          });
      }
    }
  }, [selectedRoom, cachedContent]); // Intentionally excluding historyContext to avoid re-fetch if context changes elsewhere

  // Auto-scroll to top on new room
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedRoom?.id, inspectedItem]);

  const handleInspect = async (item: string) => {
    if (!selectedRoom) return;
    setInspectLoading(true);
    const desc = await inspectItem(item, selectedRoom.name);
    setInspectedItem({ name: item, desc });
    setInspectLoading(false);
  };

  const handleBackToRoom = () => {
    setInspectedItem(null);
  };

  if (!selectedRoom) {
    return (
      <div className="h-full flex items-center justify-center p-10 text-stone-400 bg-[#fdfbf7] border-l border-stone-200">
        <div className="text-center max-w-sm">
          <p className="font-serif italic text-2xl mb-4 text-stone-600">La Vie mode d'emploi</p>
          <div className="w-16 h-px bg-stone-300 mx-auto mb-4"></div>
          <p className="font-typewriter text-sm leading-relaxed">
            The facade of the building reveals nothing. You must select a room from the grid to penetrate the lives within.
          </p>
        </div>
      </div>
    );
  }

  // Determine what to display: Cached content or Loading
  const displayContent = cachedContent;

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto p-6 md:p-12 bg-[#fdfbf7] text-stone-900 relative border-l border-stone-200">
      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#fdfbf7] z-20">
          <div className="w-12 h-12 border-2 border-t-stone-800 border-stone-300 rounded-full animate-spin mb-6"></div>
          <p className="font-typewriter text-xs animate-pulse tracking-widest uppercase">Weaving Narrative...</p>
        </div>
      )}

      <div className={`transition-opacity duration-700 ${loading ? 'opacity-0' : 'opacity-100'}`}>

        {/* Header */}
        <header className="border-b border-stone-300 pb-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
            <div>
              <h1 className="font-serif text-3xl md:text-4xl font-bold uppercase tracking-widest mb-2 text-stone-800">
                {selectedRoom.name}
              </h1>
              <p className="font-typewriter text-xs md:text-sm text-stone-500">
                FLOOR {selectedRoom.floor} • 23 JUNE 1975 • <span className="text-stone-800 font-bold">20:00</span>
              </p>
            </div>
            {displayContent?.mood && (
              <div className="font-typewriter text-[10px] md:text-xs border border-stone-400 px-3 py-1 rounded-full bg-stone-100 uppercase tracking-wider">
                Mood: {displayContent.mood}
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <div className="prose prose-stone max-w-none font-serif text-lg leading-loose text-justify">

          {inspectedItem ? (
            <div className="bg-white border border-stone-200 p-8 shadow-lg animate-fade-in my-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-stone-800"></div>
              <button
                onClick={handleBackToRoom}
                className="text-xs font-typewriter underline text-stone-400 mb-6 hover:text-stone-900 block text-right"
              >
                Return to overview
              </button>
              <h3 className="font-bold text-2xl mb-4 font-typewriter text-stone-800 uppercase tracking-wide">{inspectedItem.name}</h3>
              {inspectLoading ? (
                <p className="text-stone-400 italic font-typewriter text-sm">Magnifying...</p>
              ) : (
                <p className="italic text-stone-700 border-l-2 border-stone-300 pl-4">{inspectedItem.desc}</p>
              )}
            </div>
          ) : (
            <>
              {/* Room Description */}
              <div className="mb-12 whitespace-pre-wrap text-stone-800">
                {displayContent?.text}
              </div>

              {/* Inventory / Lists */}
              {displayContent?.items && displayContent.items.length > 0 && (
                <div className="mt-12 pt-8 border-t border-stone-200">
                  <h3 className="font-typewriter text-xs font-bold uppercase mb-6 tracking-[0.2em] text-stone-400">
                    Inventory of Interest
                  </h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                    {displayContent.items.map((item, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="font-typewriter text-xs text-stone-400 mr-3 mt-1">{(idx + 1).toString().padStart(2, '0')}</span>
                        <button
                          onClick={() => handleInspect(item)}
                          className="text-left hover:text-stone-600 transition-colors border-b border-transparent hover:border-stone-400 pb-0.5"
                        >
                          {item}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Puzzle Hint (Footer) */}
              {displayContent?.puzzle_hint && (
                <div className="mt-16 bg-[#f4f1ea] p-6 text-xs md:text-sm font-typewriter text-stone-600 flex gap-4 items-start">
                  <span className="text-xl leading-none">☞</span>
                  <span className="italic opacity-80">{displayContent.puzzle_hint}</span>
                </div>
              )}

              {/* Collectible Item */}
              {displayContent?.collectible_item && (
                <div className={`
                  mt-8 p-4 border-2 shadow-[4px_4px_0px_0px_rgba(41,37,36,1)] flex items-center justify-between
                  ${displayContent.collectible_item.type === 'puzzle_piece'
                    ? 'bg-amber-50 border-amber-600'
                    : 'bg-white border-stone-800'}
                `}>
                  <div>
                    <h4 className={`
                      font-bold font-typewriter text-sm uppercase mb-1
                      ${displayContent.collectible_item.type === 'puzzle_piece' ? 'text-amber-700' : 'text-stone-800'}
                    `}>
                      {displayContent.collectible_item.type === 'puzzle_piece' ? 'Puzzle Piece' : 'Found Item'}
                    </h4>
                    <p className="font-serif italic text-lg">{displayContent.collectible_item.name}</p>
                  </div>
                  <button
                    onClick={() => onCollectItem && onCollectItem(displayContent.collectible_item!)}
                    className={`
                      px-4 py-2 text-white font-typewriter text-xs uppercase tracking-widest transition-colors
                      ${displayContent.collectible_item.type === 'puzzle_piece'
                        ? 'bg-amber-700 hover:bg-amber-600'
                        : 'bg-stone-800 hover:bg-stone-600'}
                    `}
                  >
                    Collect
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NarrativePanel;