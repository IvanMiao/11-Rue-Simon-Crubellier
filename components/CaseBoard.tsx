import React, { useState } from 'react';
import type { CaseCard, CaseGraph, CaseState, CardKind } from '../case/types';
import { TIME_COMBINE, TIME_SUBMIT } from '../constants/skills';

interface CaseBoardProps {
  graph: CaseGraph;
  state: CaseState;
  onPlaceCard: (slotId: string, cardId: string | null) => void;
  onCombine: (a: string, b: string) => void;
  onSubmitGroup: (groupId: string) => void;
}

const KIND_LABELS: Record<CardKind, string> = {
  person: '人物',
  shape: '形状',
  place: '地点',
  object: '物件',
  testimony: '证词',
  time: '时间',
  word: '词语',
};

const CaseBoard: React.FC<CaseBoardProps> = ({
  graph,
  state,
  onPlaceCard,
  onCombine,
  onSubmitGroup,
}) => {
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const cardById = new Map<string, CaseCard>(graph.cards.map((card) => [card.id, card]));
  const placedInOtherSlot = (cardId: string, currentSlot: string) =>
    Object.entries(state.slots).some(([slotId, id]) => slotId !== currentSlot && id === cardId);

  const toggleCard = (cardId: string) => {
    setSelectedCards((selected) => {
      if (selected.includes(cardId)) return selected.filter((id) => id !== cardId);
      if (selected.length === 2) return selected;
      return [...selected, cardId];
    });
  };

  return (
    <section className="border-2 border-stone-800 bg-[#eee9df] p-4 md:p-6 shadow-[4px_4px_0px_0px_rgba(41,37,36,1)]">
      <div className="flex items-end justify-between gap-4 border-b-2 border-stone-800 pb-3 mb-5">
        <div>
          <h3 className="font-serif text-xl md:text-2xl font-bold">第 439 幅</h3>
          <p className="font-typewriter text-[10px] uppercase tracking-widest text-stone-500 mt-1">
            案卷 · {state.lockedGroups.length}/3 组已锁定
          </p>
        </div>
        <span className="font-typewriter text-[10px] text-stone-500">词卡 {state.cards.length}</span>
      </div>

      <div className="space-y-4">
        {graph.groups.map((group) => {
          const locked = state.lockedGroups.includes(group.id);
          const full = group.slots.every((slot) => Boolean(state.slots[slot.id]));
          return (
            <section key={group.id} className="border border-stone-300 bg-[#f8f5ee] p-3 md:p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h4 className="font-typewriter text-xs font-bold tracking-widest">{group.title}</h4>
                {locked && (
                  <span className="border-2 border-emerald-800 px-2 py-1 font-typewriter text-[10px] text-emerald-900 rotate-[-2deg]">
                    已锁定
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {group.slots.map((slot) => {
                  const placed = state.slots[slot.id];
                  const parts = slot.prompt.split('___');
                  const candidates = state.cards
                    .map((id) => cardById.get(id))
                    .filter(
                      (card): card is NonNullable<typeof card> =>
                        Boolean(card && slot.accepts.includes(card.kind) && !placedInOtherSlot(card.id, slot.id))
                    );
                  return (
                    <div key={slot.id} className="font-serif text-sm md:text-base leading-relaxed">
                      <span>{parts[0]}</span>
                      <button
                        type="button"
                        disabled={locked}
                        aria-label={`${slot.prompt}: ${placed ? cardById.get(placed)?.label : '空'}`}
                        aria-expanded={!locked && openSlotId === slot.id}
                        onClick={() => setOpenSlotId((current) => (current === slot.id ? null : slot.id))}
                        className={`inline-flex min-h-11 min-w-24 items-center justify-center mx-1 px-3 border-b-2 border-stone-700 bg-[#e8e2d5] font-typewriter text-xs font-bold hover:enabled:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700 focus-visible:outline-offset-2 disabled:cursor-default disabled:bg-stone-200 disabled:text-stone-500 ${
                          placed ? 'text-stone-900' : 'text-stone-400'
                        }`}
                      >
                        {placed ? cardById.get(placed)?.label : '＿＿＿'}
                      </button>
                      <span>{parts[1]}</span>
                      {!locked && openSlotId === slot.id && (
                        <div className="mt-2 flex flex-wrap gap-2 border-l-2 border-stone-300 pl-3">
                          {candidates.map((card) => (
                            <button
                              type="button"
                              key={card.id}
                              onClick={() => {
                                onPlaceCard(slot.id, card.id);
                                setOpenSlotId(null);
                              }}
                              className="min-h-11 px-3 border border-stone-400 bg-white font-typewriter text-xs hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700 focus-visible:outline-offset-2"
                            >
                              {card.label}
                            </button>
                          ))}
                          {placed && (
                            <button
                              type="button"
                              onClick={() => {
                                onPlaceCard(slot.id, null);
                                setOpenSlotId(null);
                              }}
                              className="min-h-11 px-3 border border-stone-400 bg-[#f4f1ea] font-typewriter text-xs text-stone-600 hover:bg-stone-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700 focus-visible:outline-offset-2"
                            >
                              清空
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={!full || locked}
                onClick={() => onSubmitGroup(group.id)}
                className="min-h-11 mt-4 px-4 border border-stone-800 bg-stone-800 text-[#f4f1ea] font-typewriter text-xs tracking-wide hover:enabled:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                对照（{TIME_SUBMIT} 分钟）
              </button>
            </section>
          );
        })}
      </div>

      <section className="mt-7 border-t-2 border-stone-800 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h4 className="font-typewriter text-xs font-bold tracking-widest">词卡</h4>
          <button
            type="button"
            disabled={selectedCards.length !== 2}
            onClick={() => {
              if (selectedCards.length !== 2) return;
              onCombine(selectedCards[0], selectedCards[1]);
              setSelectedCards([]);
            }}
            className="min-h-11 px-4 border border-stone-800 bg-[#e8e2d5] font-typewriter text-xs hover:enabled:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            联想（{TIME_COMBINE} 分钟） · {selectedCards.length}/2
          </button>
        </div>
        {state.cards.length === 0 ? (
          <p className="font-serif text-sm italic text-stone-500">词卡尚未入袋。</p>
        ) : (
          <div className="space-y-4">
            {(Object.keys(KIND_LABELS) as CardKind[]).map((kind) => {
              const cards = state.cards
                .map((id) => cardById.get(id))
                .filter((card) => card?.kind === kind);
              if (!cards.length) return null;
              return (
                <div key={kind}>
                  <h5 className="font-typewriter text-[10px] uppercase tracking-widest text-stone-500 mb-2">
                    {KIND_LABELS[kind]}
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {cards.map((card) => (
                      <button
                        type="button"
                        key={card!.id}
                        aria-pressed={selectedCards.includes(card!.id)}
                        onClick={() => toggleCard(card!.id)}
                        className={`min-h-11 px-3 border font-serif text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700 focus-visible:outline-offset-2 ${
                          selectedCards.includes(card!.id)
                            ? 'border-amber-800 bg-amber-100 text-stone-900'
                            : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        {card!.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-7 border-t border-stone-300 pt-5">
        <h4 className="font-typewriter text-xs font-bold tracking-widest mb-3">笔记</h4>
        {state.notes.length === 0 ? (
          <p className="font-serif text-sm italic text-stone-500">—</p>
        ) : (
          <ol className="space-y-2">
            {state.notes.map((note, index) => (
              <li key={`${index}-${note}`} className="flex gap-3 text-sm text-stone-600">
                <span className="font-typewriter text-[10px] text-stone-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="font-serif leading-relaxed">{note}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
};

export default CaseBoard;
