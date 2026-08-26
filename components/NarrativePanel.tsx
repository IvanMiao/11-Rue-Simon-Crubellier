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
import StillLifeMark from './StillLifeMark';
import { buildingAudio } from '../services/audioEngine';
import { floorLabel, stillLifeKind } from '../utils/roomArt';

interface NarrativePanelProps {
  selectedRoom: RoomData | null;
  cachedContent?: NarrativeResponse;
  onRequestGenerate: (room: RoomData) => void;
  generating: boolean;
  onInteract: (interaction: Interaction) => void;
  onCollectItem?: (item: InventoryItem) => void;
  disabledChecks?: Set<string>;
  lastMoveKind?: 'walk' | 'knight' | 'elevator';
}

const ARRIVAL = {
  walk: '走廊',
  knight: '骑士跳',
  elevator: '电梯井',
};

const VoiceLine: React.FC<{ voice: InnerVoice }> = ({ voice }) => {
  const meta = SKILL_META[voice.skill];
  if (!meta) return null;
  return (
    <div className="voice-line" style={{ ['--voice' as string]: meta.color }}>
      <span className="voice-name" style={{ color: meta.color }}>
        {meta.voice}
      </span>
      <span className="voice-text">{voice.text}</span>
    </div>
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
  lastMoveKind,
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
      <div className="folio h-full flex items-center justify-center p-10 relative">
        <div className="folio-bind" />
        <div className="text-center max-w-sm">
          <p className="folio-title text-3xl mb-4 text-[#4a3e30]">La Vie mode d'emploi</p>
          <div className="w-16 h-px bg-[#c4b49a] mx-auto mb-4" />
          <p className="font-typewriter text-sm leading-relaxed text-[#6a5e4e]">
            你从门厅起步。亮着灯的房间可以走进去；棋子落在的格子，是骑士跳。
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
    <div ref={scrollRef} className="folio h-full overflow-y-auto p-6 md:pl-14 md:pr-12 md:py-12 relative">
      <div className="folio-bind" />

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20" style={{ background: 'var(--paper-folio)' }}>
          <p className="font-typewriter text-xs tracking-[0.28em] uppercase text-[#6a5e4e]">
            正在列举房间...
          </p>
        </div>
      )}

      {typesetting && <div className="prose-ribbon">正文正在从邻房的纸边翻过来</div>}

      <div className={`transition-opacity duration-700 ${loading ? 'opacity-0' : 'opacity-100'}`}>
        <header className="pb-6 mb-8 border-b border-[#d6c8ae]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <p className="folio-kicker">
              {floorLabel(selectedRoom.floor)} · 23 juin 1975
            </p>
            <div className="flex items-center gap-2">
              {lastMoveKind && (
                <span className="arrival-stamp">{ARRIVAL[lastMoveKind]}</span>
              )}
              {displayContent?.mood && (
                <span className="mood-chip">气氛 {displayContent.mood}</span>
              )}
            </div>
          </div>
          <h1 className="folio-title text-4xl md:text-5xl uppercase text-[#1c1610]">
            {selectedRoom.name || '未标名'}
          </h1>
          <p className="font-typewriter text-[11px] text-[#8a7c6a] mt-2 tracking-widest">
            时间已冻结，只有你在走
          </p>
        </header>

        {inspectedItem ? (
          <div className="inspect-card">
            <button
              onClick={() => setInspectedItem(null)}
              className="text-xs font-typewriter uppercase tracking-widest text-[#8a7c6a] mb-6 hover:text-[#1c1610]"
            >
              ← 回到房间
            </button>
            <div className="flex items-center gap-3 mb-4">
              <StillLifeMark kind={stillLifeKind(inspectedItem.name)} className="w-8 h-8 text-[#4a3e30]" />
              <h3 className="folio-title text-2xl uppercase">{inspectedItem.name}</h3>
            </div>
            {inspectLoading ? (
              <p className="text-[#8a7c6a] italic font-typewriter text-sm">放大中...</p>
            ) : (
              <p className="folio-prose italic border-l-2 border-[#c4b49a] pl-4">{inspectedItem.desc}</p>
            )}
          </div>
        ) : (
          <>
            <TypewriterText
              key={`${selectedRoom.id}:${displayContent?.source || 'none'}:${(displayContent?.text || '').slice(0, 24)}`}
              text={displayContent?.text || ''}
              className="folio-prose mb-8 whitespace-pre-wrap"
            />

            {displayContent?.npcs_present && displayContent.npcs_present.length > 0 && (
              <div className="mb-8 flex items-center gap-3">
                <span className="room-silhouette stand" style={{ position: 'relative', left: 0, bottom: 0, width: 14, height: 28, opacity: 0.7 }} />
                <p className="folio-kicker">
                  窗里的人 · {displayContent.npcs_present.join(' · ')}
                </p>
              </div>
            )}

            {displayContent?.inner_voices?.map((voice, idx) => (
              <VoiceLine key={idx} voice={voice} />
            ))}

            {displayContent?.journal?.map((entry, idx) => (
              <div key={idx} className="journal-entry">
                {entry}
              </div>
            ))}
            <div ref={bottomRef} />

            {displayContent?.available_interactions && displayContent.available_interactions.length > 0 && (
              <section className="my-10">
                <h3 className="folio-section-label mb-4">可做之事</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {displayContent.available_interactions.map((action, idx) => {
                    const id = action.id || `act-${idx}`;
                    const used = consumed.has(id);
                    const locked = disabledChecks?.has(id) || used;
                    const skill = action.skill as SkillId | undefined;
                    const meta = skill ? SKILL_META[skill] : null;
                    const red = action.kind === 'red';
                    return (
                      <button
                        key={id}
                        disabled={locked}
                        onClick={() => {
                          buildingAudio.ui();
                          onInteract({ ...action, id });
                        }}
                        className={`check-ticket ${red ? 'is-red' : ''}`}
                      >
                        <div
                          className="check-ticket-rail"
                          style={{ background: meta?.color || '#2a2218' }}
                        />
                        <div className="check-ticket-body">
                          <div className="check-ticket-meta">
                            {meta ? `${meta.name} · ${DIFFICULTY_LABEL[action.difficulty || 'medium']}` : '动作'}
                            {red ? ' · 红检' : meta ? ' · 白检' : ''}
                          </div>
                          <div className="check-ticket-label">{action.label}</div>
                        </div>
                        <div className="perforation" />
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {displayContent?.items && displayContent.items.length > 0 && (
              <section className="mt-4">
                <h3 className="folio-section-label mb-2">在场物件</h3>
                <ul>
                  {displayContent.items.map((item, idx) => (
                    <li key={idx}>
                      <button className="catalog-row" onClick={() => handleInspect(item)}>
                        <span className="catalog-index">{(idx + 1).toString().padStart(2, '0')}</span>
                        <StillLifeMark kind={stillLifeKind(item)} className="catalog-mark" />
                        <span className="font-serif text-[1.05rem]">{item}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {displayContent?.puzzle_hint && (
              <div className="hint-slip mt-10">
                ☞ {displayContent.puzzle_hint}
              </div>
            )}

            {displayContent?.offered_thought && (
              <div className="thought-card mt-8">
                <div className="folio-kicker mb-1" style={{ color: '#5b3d8a' }}>
                  一个念头想住进来
                </div>
                <div className="folio-title text-2xl">{displayContent.offered_thought.title}</div>
                <p className="text-sm text-[#4a3e30] mt-1">{displayContent.offered_thought.description}</p>
                <p className="font-typewriter text-[10px] mt-2 tracking-widest uppercase" style={{ color: '#5b3d8a' }}>
                  打开案卷柜可以把它内化
                </p>
              </div>
            )}

            {displayContent?.collectible_item && (
              <div
                className={`evidence-card mt-8 ${
                  displayContent.collectible_item.type === 'puzzle_piece' ? 'is-puzzle' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StillLifeMark
                    kind={
                      displayContent.collectible_item.type === 'puzzle_piece'
                        ? 'puzzle'
                        : stillLifeKind(displayContent.collectible_item.name)
                    }
                    className="w-8 h-8 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="folio-kicker mb-1">
                      {displayContent.collectible_item.type === 'puzzle_piece' ? '拼图片' : '拾得物'}
                    </div>
                    <p className="folio-title text-xl truncate">{displayContent.collectible_item.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    buildingAudio.collect();
                    onCollectItem && onCollectItem(displayContent.collectible_item!);
                  }}
                  className="shrink-0 px-4 py-2 bg-[#2a2218] text-[#f4ead6] font-typewriter text-[10px] uppercase tracking-[0.2em]"
                >
                  收下
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NarrativePanel;
