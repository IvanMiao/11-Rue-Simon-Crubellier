import React from 'react';
import { RoomData } from '../types';
import { BUILDING_LAYOUT } from '../constants';
import { ReachableMap } from '../utils/gridLogic';
import { floorLabel, roomLook } from '../utils/roomArt';
import KnightGlyph from './KnightGlyph';

interface BuildingMapProps {
  onRoomSelect: (room: RoomData) => void;
  selectedRoomId: string | null;
  visitedRoomIds: Set<string>;
  reachable: ReachableMap;
  puzzlePiecesCollected: number;
  lastMoveKind?: 'walk' | 'knight' | 'elevator';
  onBlocked?: (room: RoomData) => void;
}

const BuildingMap: React.FC<BuildingMapProps> = ({
  onRoomSelect,
  selectedRoomId,
  visitedRoomIds,
  reachable,
  puzzlePiecesCollected,
  lastMoveKind,
  onBlocked,
}) => {
  const floors = [8, 7, 6, 5, 4, 3, 2, 1, 0, -1];
  if (puzzlePiecesCollected >= 5 || reachable.all.has('100-1')) {
    floors.unshift(100);
  }

  const getRoomsOnFloor = (floor: number) => BUILDING_LAYOUT.filter((r) => r.floor === floor);

  return (
    <div className="section-sheet w-full h-full overflow-y-auto p-3 md:p-6 border-r border-[#c4b49a] flex flex-col items-center">
      <p className="font-typewriter text-[10px] text-[#6a5e4e] tracking-[0.35em] uppercase mb-1">
        Coupe · 11, rue Simon-Crubellier
      </p>
      <h2 className="section-title text-2xl md:text-3xl mb-1 text-[#2a2218] uppercase">剖面</h2>
      <p className="font-typewriter text-[10px] text-[#8a7c6a] mb-4 tracking-[0.22em] uppercase">
        二十点整 · 人已冻结 · 只有视线在走
      </p>

      <div className="section-stack w-full max-w-[52rem]">
        <div className="section-roof ml-[2.4rem]">
          <span className="section-chimney" style={{ left: '18%' }} />
          <span className="section-chimney" style={{ left: '38%' }} />
          <span className="section-chimney" style={{ left: '62%' }} />
          <span className="section-chimney" style={{ left: '78%' }} />
        </div>

        <div className="section-frame">
          <aside className="floor-rail" aria-hidden>
            {floors.map((floor) => (
              <span key={floor}>{floorLabel(floor)}</span>
            ))}
          </aside>

          <div className="min-w-0 flex-1">
            <div className="section-grid">
              <div className="section-pipes" />
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
                    const look = roomLook(room);
                    const showLife = isVisited || isSelected || isReachable;
                    const silClass = isSelected
                      ? 'investigator'
                      : showLife
                        ? look.silhouette
                        : 'empty';

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
                          ['--lamp' as string]: look.lamp,
                          ['--paint' as string]: look.paint,
                        }}
                        className={[
                          'room-cell',
                          isElevator ? 'is-elevator' : '',
                          room.type === 'basement' ? 'is-basement' : '',
                          isSelected ? 'is-selected' : '',
                          isWalk ? 'is-walk' : '',
                          !isReachable && !isSelected ? 'is-blocked' : '',
                        ].join(' ')}
                      >
                        {showLife && <span className={`room-window ${look.window}`} />}
                        {showLife && look.occupied && (
                          <span className={`room-silhouette ${silClass}`} />
                        )}
                        {isKnight && !isSelected && <KnightGlyph className="room-knight" />}
                        <span
                          className="room-plate"
                          style={{
                            fontSize: room.colSpan && room.colSpan < 2 ? '0.48rem' : undefined,
                          }}
                        >
                          {room.name}
                        </span>
                        {isSelected && (
                          <span className="room-gaze">
                            {lastMoveKind === 'knight'
                              ? '♞'
                              : lastMoveKind === 'elevator'
                                ? '↕'
                                : '●'}
                          </span>
                        )}
                        {isLift && !isSelected && !isElevator && (
                          <span className="room-gaze" style={{ color: '#8a7c6a' }}>
                            ↕
                          </span>
                        )}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            <div className="section-street">Rue Simon-Crubellier · 20h00</div>
          </div>
        </div>
      </div>

      <div className="section-legend mt-8 text-center max-w-md">
        <p className="font-serif italic text-sm mb-3">「整栋楼是一道有限的棋题。」</p>
        <div className="flex flex-wrap justify-center gap-4 text-[10px] font-typewriter uppercase tracking-widest">
          <span>窗亮 = 可走</span>
          <span>♞ = 骑士跳</span>
          <span>黄边 = 你的视线</span>
          <span>窗帘落下 = 走不到</span>
        </div>
      </div>
    </div>
  );
};

export default BuildingMap;
