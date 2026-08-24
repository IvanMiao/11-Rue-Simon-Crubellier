import React from 'react';
import { endingBody, endingTitle } from '../utils/gameLogic';
import { formatSeed } from '../utils/rng';
import { PlayerState } from '../types';

interface RunEndScreenProps {
  state: PlayerState;
  onAgain: () => void;
}

const RunEndScreen: React.FC<RunEndScreenProps> = ({ state, onAgain }) => {
  const status = state.runStatus;
  if (status !== 'solved' && status !== 'midnight' && status !== 'collapsed') return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#eae7dc] p-6">
      <div className="max-w-2xl text-center">
        <p className="font-typewriter text-xs tracking-[0.4em] uppercase text-stone-500 mb-4">
          {status === 'solved' ? 'Ending · Solved' : status === 'midnight' ? 'Ending · Time' : 'Ending · Morale'}
          {' · '}SEED {formatSeed(state.runSeed)}
        </p>
        <h1 className="font-serif text-4xl md:text-6xl font-bold mb-6">{endingTitle(status)}</h1>
        <p className="font-serif text-lg leading-loose text-stone-700 mb-8">{endingBody(status)}</p>
        <div className="font-typewriter text-xs text-stone-500 space-y-1 mb-10">
          <div>走访房间 {state.roomsVisitedCount}</div>
          <div>线索 {state.discoveredFacts.length} · 拼图片 {state.puzzlePiecesCollected}</div>
          <div>检定 {state.checkLog.filter((c) => c.success).length}/{state.checkLog.length} 成功</div>
        </div>
        <button
          onClick={onAgain}
          className="px-8 py-3 bg-stone-800 text-[#f4f1ea] font-typewriter text-xs uppercase tracking-[0.25em]"
        >
          再开一局 · 新的种子
        </button>
      </div>
    </div>
  );
};

export default RunEndScreen;
