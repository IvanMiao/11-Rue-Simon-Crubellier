import React from 'react';
import { RoomData } from '../types';
import { BUILDING_LAYOUT } from '../constants';

interface BuildingMapProps {
  onRoomSelect: (room: RoomData) => void;
  selectedRoomId: string | null;
  visitedRoomIds: Set<string>;
  validKnightMoves: Set<string>;
  puzzlePiecesCollected: number;
}

const BuildingMap: React.FC<BuildingMapProps> = ({ onRoomSelect, selectedRoomId, visitedRoomIds, validKnightMoves, puzzlePiecesCollected }) => {
  // Group by floor for rendering rows
  const floors = [8, 7, 6, 5, 4, 3, 2, 1, 0, -1];

  if (puzzlePiecesCollected >= 5) {
    floors.unshift(100); // Add hidden floor at the top
  }

  const getRoomsOnFloor = (floor: number) =>
    BUILDING_LAYOUT.filter(r => r.floor === floor);

  return (
    <div className="w-full h-full overflow-y-auto p-2 md:p-6 bg-[#eae7dc] border-r border-stone-300 shadow-inner flex flex-col items-center">
      <h2 className="font-serif text-xl mb-6 tracking-widest text-stone-800 font-bold uppercase">
        11 Rue Simon-Crubellier
      </h2>

      {/* The Grid Container: 10 columns strict */}
      <div className="grid grid-cols-10 auto-rows-[60px] gap-0.5 p-2 bg-stone-800 border-4 border-stone-800 w-full max-w-3xl shadow-2xl">
        {floors.map((floorNum) => (
          <React.Fragment key={floorNum}>
            {getRoomsOnFloor(floorNum).map((room) => {
              const isSelected = selectedRoomId === room.id;
              const isVisited = visitedRoomIds.has(room.id);
              const isElevator = room.type === 'elevator';
              const isKnightMove = validKnightMoves.has(room.id);

              return (
                <button
                  key={room.id}
                  onClick={() => onRoomSelect(room)}
                  style={{
                    gridColumn: `span ${room.colSpan || 1}`,
                    gridRow: `span ${room.rowSpan || 1}`,
                  }}
                  className={`
                     relative group flex flex-col items-center justify-center 
                     transition-all duration-300 ease-out border border-stone-400/30
                     ${isSelected
                      ? 'bg-stone-800 text-white z-20 scale-105 shadow-[0_0_15px_rgba(0,0,0,0.5)] border-stone-500'
                      : isElevator
                        ? 'bg-stone-900 text-stone-600 border-stone-700 z-10' // Elevator style
                        : isKnightMove
                          ? 'bg-[#e8e4d0] text-stone-900 border-stone-500 shadow-[inset_0_0_10px_rgba(255,215,0,0.2)]' // Knight's move hint
                          : isVisited
                            ? 'bg-[#dcd6c6] text-stone-800' // Visited but not selected
                            : 'bg-[#f4f1ea] text-stone-500 hover:bg-[#e6dfce] hover:text-stone-900' // Unvisited
                    }
                   `}
                >
                  {/* Room Name */}
                  <span className={`
                     font-typewriter font-bold uppercase leading-none text-center px-1
                     ${room.colSpan && room.colSpan < 2 ? 'text-[0.5rem]' : 'text-[0.6rem] md:text-[0.7rem]'}
                   `}>
                    {room.name}
                  </span>

                  {/* Visited Marker (Subtle dot) */}
                  {isVisited && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-stone-400"></span>
                  )}

                  {/* Hover Pattern */}
                  {!isSelected && (
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/diagonal-noise.png')]"></div>
                  )}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-8 text-center max-w-md">
        <p className="font-typewriter text-xs text-stone-500 italic mb-2">
          "The entire building is a puzzle to be solved."
        </p>
        <div className="flex justify-center gap-4 text-[10px] font-typewriter text-stone-400 uppercase">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[#f4f1ea] border border-stone-300"></div> Unexplored
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[#dcd6c6] border border-stone-300"></div> Explored
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-stone-800 border border-stone-300"></div> Current
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuildingMap;