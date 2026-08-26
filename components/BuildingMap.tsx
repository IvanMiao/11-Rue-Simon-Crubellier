import React, { Suspense } from 'react';
import { RoomData } from '../types';
import { ReachableMap } from '../utils/gridLogic';
import BuildingCanvas from './section/BuildingCanvas';

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
  return (
    <div className="section-stage w-full h-full flex flex-col relative">
      <header className="section-stage-label pointer-events-none">
        <p className="font-typewriter text-[10px] tracking-[0.32em] uppercase text-[#c4b49a]">
          Coupe · 11, rue Simon-Crubellier · 20h00
        </p>
        <h2 className="font-display text-2xl tracking-[0.18em] uppercase text-[#f0e6d2]">剖面模型</h2>
        <p className="font-typewriter text-[10px] tracking-[0.2em] uppercase text-[#8a7c6a] mt-0.5">
          {lastMoveKind === 'knight'
            ? '骑士落盘 · 超清醒'
            : lastMoveKind === 'elevator'
              ? '井道里的垂直句子'
              : '视线在走，人已冻结'}
        </p>
      </header>
      <div className="flex-1 min-h-0">
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center font-typewriter text-[10px] tracking-[0.28em] uppercase text-[#c4b49a]">
              正在排版剖面模型…
            </div>
          }
        >
          <BuildingCanvas
            onRoomSelect={onRoomSelect}
            selectedRoomId={selectedRoomId}
            visitedRoomIds={visitedRoomIds}
            reachable={reachable}
            puzzlePiecesCollected={puzzlePiecesCollected}
            onBlocked={onBlocked}
          />
        </Suspense>
      </div>
      <div className="section-stage-legend">
        窗亮可走 · 金色马是骑士跳 · 拖动视线 · 点进房间
      </div>
    </div>
  );
};

export default BuildingMap;
