import React from 'react';
import type { CaseGraph } from '../../case/types';
import { cardIconUrl } from '../../art/cardIcons';

export interface Arrival {
  key: string;
  cardId: string;
  footnote: string;
}

interface NotebookProps {
  owned: boolean;
  justFound: boolean;
  cards: number;
  locked: number;
  graph: CaseGraph | null;
  arrivals: Arrival[];
  onOpen: () => void;
}

/** Valène's sketchbook, which is the case file. It does not exist until you pick it up on the stairs. */
const Notebook: React.FC<NotebookProps> = ({ owned, justFound, cards, locked, graph, arrivals, onOpen }) => (
  <div className="relative">
    <div className="absolute bottom-full left-0 mb-2 flex flex-col gap-2 w-72 pointer-events-none">
      {arrivals.map((arrival) => (
        <div key={arrival.key} className="card-arrival world-card !p-2 flex gap-2 items-center">
          <img src={cardIconUrl(arrival.cardId, 64)} alt="" className="w-10 h-10" />
          <div>
            <div className="font-serif font-bold text-sm">{graph?.cards.find((c) => c.id === arrival.cardId)?.label}</div>
            <div className="world-footnote !text-[10px]">{arrival.footnote}</div>
          </div>
        </div>
      ))}
    </div>
    <button
      type="button"
      className={`notebook-tab ${owned ? '' : 'is-empty'} ${justFound ? 'is-new' : ''}`}
      disabled={!owned}
      onClick={onOpen}
    >
      {owned && <span className="notebook-cover" />}
      {owned ? (
        <span>
          瓦莱纳的速写本 · 词卡 {cards} · 对上 {locked}/3
        </span>
      ) : (
        <span>口袋是空的 · 案卷还没有到你手里</span>
      )}
    </button>
  </div>
);

export default Notebook;
