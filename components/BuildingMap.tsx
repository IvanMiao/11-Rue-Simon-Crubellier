import React from 'react';
import { RoomData } from '../types';
import { BUILDING_LAYOUT } from '../constants';
import { ReachableMap } from '../utils/gridLogic';

interface BuildingMapProps {
  onRoomSelect: (room: RoomData) => void;
  selectedRoomId: string | null;
  visitedRoomIds: Set<string>;
  reachable: ReachableMap;
  puzzlePiecesCollected: number;
  onBlocked?: (room: RoomData) => void;
}

const BuildingMap: React.FC<BuildingMapProps> = ({
  onRoomSelect,
  selectedRoomId,
  visitedRoomIds,
  reachable,
  puzzlePiecesCollected,
  onBlocked,
}) => {
  const floors = [8, 7, 6, 5, 4, 3, 2, 1, 0, -1];

  if (puzzlePiecesCollected >= 5 || reachable.all.has('100-1')) {
    floors.unshift(100);
  }

  const getRoomsOnFloor = (floor: number) => BUILDING_LAYOUT.filter((r) => r.floor === floor);

  return (
    <div className="w-full h-full overflow-y-auto p-2 md:p-6 bg-[#eae7dc] border-r border-stone-300 shadow-inner flex flex-col items-center">
      <h2 className="font-serif text-xl mb-2 tracking-widest text-stone-800 font-bold uppercase">
        11 Rue Simon-Crubellier
      </h2>
      <p className="font-typewriter text-[10px] text-stone-500 mb-4 uppercase tracking-widest">
        走廊相邻 · 骑士跳 · 电梯井
      </p>

      <div className="grid grid-cols-10 auto-rows-[60px] gap-0.5 p-2 bg-stone-800 border-4 border-stone-800 w-full max-w-3xl shadow-2xl">
        {floors.map((floorNum) => (
          <React.Fragment key={floorNum}>
            {getRoomsOnFloor(floorNum).map((room) => {
              const isSelected = selectedRoomId === room.id;
              const isVisited = visitedRoomIds.has(room.id);
              const isElevator = room.type === 'elevator';
              const isKnight = reachable.knight.has(room.id);
              const isWalk = reachable.walk.has(room.id);
              const isLift = reachable.elevator.has(room.id);
              const isReachable = reachable.all.has(room.id) || isSelected;

              return (
                <button
                  key={room.id}
                  onClick={() => {
                    if (isSelected) return;
                    if (isReachable) onRoomSelect(room);
                    else onBlocked?.(room);
                  }}
                  style={{
                    gridColumn: `span ${room.colSpan || 1}`,
                    gridRow: `span ${room.rowSpan || 1}`,
                  }}
                  className={`
                     relative group flex flex-col items-center justify-center 
                     transition-all duration-300 ease-out border border-stone-400/30
                     ${
                       isSelected
                         ? 'bg-stone-800 text-white z-20 scale-105 shadow-[0_0_15px_rgba(0,0,0,0.5)] border-stone-500'
                         : isElevator && isReachable
                           ? 'bg-stone-900 text-amber-200 border-amber-700 z-10'
                           : isKnight
                             ? 'bg-[#e8e4d0] text-stone-900 border-amber-400 shadow-[inset_0_0_10px_rgba(255,215,0,0.25)]'
                             : isLift
                               ? 'bg-[#ddd6c4] text-stone-800 border-stone-500'
                               : isWalk
                                 ? 'bg-[#efe8d4] text-stone-800'
                                 : isVisited
                                   ? 'bg-[#dcd6c6] text-stone-500'
                                   : 'bg-[#f4f1ea] text-stone-300'
                     }
                     ${!isReachable && !isSelected ? 'cursor-not-allowed opacity-70' : ''}
                   `}
                >
                  <span
                    className={`
                     font-typewriter font-bold uppercase leading-none text-center px-1
                     ${room.colSpan && room.colSpan < 2 ? 'text-[0.5rem]' : 'text-[0.6rem] md:text-[0.7rem]'}
                   `}
                  >
                    {room.name}
                  </span>

                  {isVisited && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-stone-400"></span>
                  )}
                  {isKnight && !isSelected && (
                    <span className="absolute top-1 right-1 text-[8px] text-amber-700 font-typewriter">♞</span>
                  )}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-8 text-center max-w-md">
        <p className="font-typewriter text-xs text-stone-500 italic mb-2">
          「整栋楼是一道有限的棋题。」
        </p>
        <div className="flex flex-wrap justify-center gap-3 text-[10px] font-typewriter text-stone-400 uppercase">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[#efe8d4] border border-stone-300"></div> 走廊
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[#e8e4d0] border border-amber-400"></div> 骑士跳
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-stone-800 border border-stone-300"></div> 当前位置
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[#f4f1ea] border border-stone-300 opacity-70"></div> 走不到
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuildingMap;
