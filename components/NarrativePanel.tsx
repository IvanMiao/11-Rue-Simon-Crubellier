import React, { useEffect, useState, useRef } from 'react';
import {
  RoomData,
  NarrativeResponse,
  InventoryItem,
  Interaction,
  InnerVoice,
  SkillId,
} from '../types';
import { inspectItem } from '../services/geminiService';
import { DIFFICULTY_LABEL, SKILL_META } from '../constants/skills';
import TypewriterText from './TypewriterText';
import { buildingAudio } from '../services/audioEngine';

interface NarrativePanelProps {
  selectedRoom: RoomData | null;
  cachedContent?: NarrativeResponse;
  onRequestGenerate: (room: RoomData) => void;
  generating: boolean;
  onInteract: (interaction: Interaction) => void;
  onCollectItem?: (item: InventoryItem) => void;
  disabledChecks?: Set<string>;
}

const VoiceLine: React.FC<{ voice: InnerVoice }> = ({ voice }) => {
  const meta = SKILL_META[voice.skill];
  if (!meta) return null;
  return (
    <p className="font-typewriter text-sm leading-relaxed my-4">
      <span className="font-bold uppercase tracking-wide" style={{ color: meta.color }}>
        {meta.voice}
      </span>
      <span className="text-stone-400"> — </span>
      <span className="text-stone-700">{voice.text}</span>
    </p>
  );
};

const NarrativePanel: React.FC<NarrativePanelProps> = ({
  selectedRoom,
  cachedContent,
  onRequestGenerate,
  generating,
  onInteract,
  onCollectItem,
  disabledChecks,
}) => {
  const [inspectedItem, setInspectedItem] = useState<{ name: string; desc: string } | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedRoom) return;
    setInspectedItem(null);
    if (!cachedContent && !generating) {
      onRequestGenerate(selectedRoom);
    }
  }, [selectedRoom?.id, cachedContent, generating]);

  useEffect(() => {
    if (scrollRef.current && !generating) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (selectedRoom) buildingAudio.page();
  }, [selectedRoom?.id, generating]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [cachedContent?.journal?.length]);

  const handleInspect = async (item: string) => {
    if (!selectedRoom) return;
    setInspectLoading(true);
    const desc = await inspectItem(item, selectedRoom.name);
    setInspectedItem({ name: item, desc });
    setInspectLoading(false);
  };

  if (!selectedRoom) {
    return (
      <div className="h-full flex items-center justify-center p-10 text-stone-400 bg-[#fdfbf7] border-l border-stone-200">
        <div className="text-center max-w-sm">
          <p className="font-serif italic text-2xl mb-4 text-stone-600">La Vie mode d'emploi</p>
          <div className="w-16 h-px bg-stone-300 mx-auto mb-4"></div>
          <p className="font-typewriter text-sm leading-relaxed">
            你从门厅起步。走廊相连的房间可以走进去；金色的格子是骑士跳——佩雷克留给你的捷径。
          </p>
        </div>
      </div>
    );
  }

  const displayContent = cachedContent;
  const consumed = new Set(displayContent?.consumed_interaction_ids || []);
  const loading = generating && !displayContent;
  const typesetting = generating && displayContent?.source === 'skeleton';

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto p-6 md:p-12 bg-[#fdfbf7] text-stone-900 relative border-l border-stone-200"
    >
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#fdfbf7] z-20">
          <div className="w-12 h-12 border-2 border-t-stone-800 border-stone-300 rounded-full animate-spin mb-6"></div>
          <p className="font-typewriter text-xs animate-pulse tracking-widest uppercase">
            正在列举房间...
          </p>
        </div>
      )}

      {typesetting && (
        <div className="prose-ribbon">正文正在从邻房的纸边翻过来</div>
      )}

      <div className={`transition-opacity duration-700 ${loading ? 'opacity-0' : 'opacity-100'}`}>
        <header className="border-b border-stone-300 pb-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
            <div>
              <h1 className="font-serif text-3xl md:text-4xl font-bold uppercase tracking-widest mb-2 text-stone-800">
                {selectedRoom.name || '未标名'}
              </h1>
              <p className="font-typewriter text-xs md:text-sm text-stone-500">
                {selectedRoom.floor} 层 · 1975年6月23日 · 时间已冻结，只有你在走
              </p>
            </div>
            {displayContent?.mood && (
              <div className="font-typewriter text-[10px] md:text-xs border border-stone-400 px-3 py-1 rounded-full bg-stone-100 uppercase tracking-wider">
                气氛: {displayContent.mood}
              </div>
            )}
          </div>
        </header>

        <div className="prose prose-stone max-w-none font-serif text-lg leading-loose text-justify">
          {inspectedItem ? (
            <div className="bg-white border border-stone-200 p-8 shadow-lg my-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-stone-800"></div>
              <button
                onClick={() => setInspectedItem(null)}
                className="text-xs font-typewriter underline text-stone-400 mb-6 hover:text-stone-900 block text-right"
              >
                回到房间
              </button>
              <h3 className="font-bold text-2xl mb-4 font-typewriter text-stone-800 uppercase tracking-wide">
                {inspectedItem.name}
              </h3>
              {inspectLoading ? (
                <p className="text-stone-400 italic font-typewriter text-sm">放大中...</p>
              ) : (
                <p className="italic text-stone-700 border-l-2 border-stone-300 pl-4">{inspectedItem.desc}</p>
              )}
            </div>
          ) : (
            <>
              <TypewriterText
                key={`${selectedRoom.id}:${displayContent?.source || 'none'}:${(displayContent?.text || '').slice(0, 24)}`}
                text={displayContent?.text || ''}
                className="mb-8 whitespace-pre-wrap text-stone-800"
              />

              {displayContent?.npcs_present && displayContent.npcs_present.length > 0 && (
                <div className="mb-6 font-typewriter text-xs uppercase tracking-widest text-stone-500">
                  在场：{displayContent.npcs_present.join(' · ')}
                </div>
              )}

              {displayContent?.inner_voices?.map((voice, idx) => (
                <VoiceLine key={idx} voice={voice} />
              ))}

              {displayContent?.journal?.map((entry, idx) => (
                <div key={idx} className="mt-4 whitespace-pre-wrap text-stone-800 border-l-2 border-stone-300 pl-4">
                  {entry}
                </div>
              ))}
              <div ref={bottomRef} />

              {displayContent?.available_interactions && displayContent.available_interactions.length > 0 && (
                <div className="my-8 border-t border-b border-stone-200 py-6">
                  <h3 className="font-typewriter text-xs font-bold uppercase mb-4 tracking-[0.2em] text-stone-400">
                    可做之事
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {displayContent.available_interactions.map((action, idx) => {
                      const id = action.id || `act-${idx}`;
                      const used = consumed.has(id);
                      const locked = disabledChecks?.has(id) || used;
                      const skill = action.skill as SkillId | undefined;
                      const meta = skill ? SKILL_META[skill] : null;
                      return (
                        <button
                          key={id}
                          disabled={locked}
                          onClick={() => {
                            buildingAudio.ui();
                            onInteract({ ...action, id });
                          }}
                          className="px-4 py-2 border border-stone-800 text-stone-800 font-typewriter text-xs uppercase hover:bg-stone-800 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-stone-800"
                          title={
                            meta
                              ? `${meta.name} / ${DIFFICULTY_LABEL[action.difficulty || 'medium']} / ${action.kind === 'red' ? '红检' : '白检'}`
                              : undefined
                          }
                        >
                          {action.label}
                          {meta && (
                            <span className="block text-[9px] tracking-widest mt-1 opacity-70">
                              {meta.name} · {DIFFICULTY_LABEL[action.difficulty || 'medium']}
                              {action.kind === 'red' ? ' · 红' : ''}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {displayContent?.items && displayContent.items.length > 0 && (
                <div className="mt-8 pt-8 border-t border-stone-200">
                  <h3 className="font-typewriter text-xs font-bold uppercase mb-6 tracking-[0.2em] text-stone-400">
                    在场物件
                  </h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                    {displayContent.items.map((item, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="font-typewriter text-xs text-stone-400 mr-3 mt-1">
                          {(idx + 1).toString().padStart(2, '0')}
                        </span>
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

              {displayContent?.puzzle_hint && (
                <div className="mt-16 bg-[#f4f1ea] p-6 text-xs md:text-sm font-typewriter text-stone-600 flex gap-4 items-start">
                  <span className="text-xl leading-none">☞</span>
                  <span className="italic opacity-80">{displayContent.puzzle_hint}</span>
                </div>
              )}

              {displayContent?.offered_thought && (
                <div className="mt-8 p-4 border border-violet-800 bg-violet-50">
                  <div className="font-typewriter text-[10px] uppercase tracking-widest text-violet-800 mb-1">
                    一个念头想住进来
                  </div>
                  <div className="font-serif font-bold">{displayContent.offered_thought.title}</div>
                  <p className="text-sm text-stone-600 mt-1">{displayContent.offered_thought.description}</p>
                  <p className="font-typewriter text-[10px] mt-2 text-violet-800">
                    打开案卷柜可以把它内化。
                  </p>
                </div>
              )}

              {displayContent?.collectible_item && (
                <div
                  className={`
                  mt-8 p-4 border-2 shadow-[4px_4px_0px_0px_rgba(41,37,36,1)] flex items-center justify-between
                  ${
                    displayContent.collectible_item.type === 'puzzle_piece'
                      ? 'bg-amber-50 border-amber-600'
                      : 'bg-white border-stone-800'
                  }
                `}
                >
                  <div>
                    <h4
                      className={`
                      font-bold font-typewriter text-sm uppercase mb-1
                      ${displayContent.collectible_item.type === 'puzzle_piece' ? 'text-amber-700' : 'text-stone-800'}
                    `}
                    >
                      {displayContent.collectible_item.type === 'puzzle_piece' ? '拼图片' : '拾得物'}
                    </h4>
                    <p className="font-serif italic text-lg">{displayContent.collectible_item.name}</p>
                  </div>
                  <button
                    onClick={() => {
                      buildingAudio.collect();
                      onCollectItem && onCollectItem(displayContent.collectible_item!);
                    }}
                    className={`
                      px-4 py-2 text-white font-typewriter text-xs uppercase tracking-widest transition-colors
                      ${
                        displayContent.collectible_item.type === 'puzzle_piece'
                          ? 'bg-amber-700 hover:bg-amber-600'
                          : 'bg-stone-800 hover:bg-stone-600'
                      }
                    `}
                  >
                    收下
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
