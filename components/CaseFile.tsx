import React from 'react';
import { DIFFICULTY_LABEL, SKILL_META, XP_PER_LEVEL } from '../constants/skills';
import { clockLabel, skillValue } from '../utils/gameLogic';
import { formatSeed } from '../utils/rng';
import { PlayerState, SkillId } from '../types';

interface CaseFileProps {
  isOpen: boolean;
  onClose: () => void;
  state: PlayerState;
  onInternalize: (thoughtId: string) => void;
  onSpendPoint: (skill: SkillId) => void;
}

const CaseFile: React.FC<CaseFileProps> = ({ isOpen, onClose, state, onInternalize, onSpendPoint }) => {
  if (!isOpen) return null;

  const knownThreads = state.plotThreads.filter((t) => t.status !== 'unknown');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[#f4f1ea] w-full max-w-4xl max-h-[90vh] overflow-hidden rounded shadow-2xl border-4 border-stone-800 flex flex-col">
        <div className="bg-stone-800 text-[#f4f1ea] p-5 flex justify-between items-start shrink-0">
          <div>
            <h2 className="font-serif text-2xl md:text-3xl font-bold uppercase tracking-widest mb-1">
              案卷柜
            </h2>
            <p className="font-typewriter text-xs opacity-70">
              只收录你已经看见的东西 · {clockLabel(state.minutesPastEight)} · SEED {formatSeed(state.runSeed)}
            </p>
          </div>
          <button onClick={onClose} className="font-typewriter text-xl hover:text-red-300">
            [X]
          </button>
        </div>

        <div className="p-6 md:p-10 space-y-10 overflow-y-auto">
          <section>
            <h3 className="font-typewriter text-sm font-bold uppercase border-b-2 border-stone-800 mb-4 pb-2">
              已知线索
            </h3>
            {state.discoveredFacts.length === 0 ? (
              <p className="font-serif italic text-stone-500">案卷还是空的。去碰一碰那些不肯被列举的物件。</p>
            ) : (
              <ul className="space-y-3">
                {state.discoveredFacts.map((fact, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-typewriter text-stone-400">{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-serif">{fact}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="font-typewriter text-sm font-bold uppercase border-b-2 border-stone-800 mb-4 pb-2">
              情节线
            </h3>
            {knownThreads.length === 0 ? (
              <p className="font-serif italic text-stone-500">你还没有抓住任何一条线。楼里的故事在互相躲避。</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {knownThreads.map((thread) => (
                  <div key={thread.id} className="bg-white border border-stone-200 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-serif font-bold text-lg">{thread.title}</h4>
                      <span className="font-typewriter text-[10px] uppercase bg-stone-100 px-2 py-0.5">
                        {thread.status}
                      </span>
                    </div>
                    <ul className="text-sm text-stone-600 space-y-1">
                      {thread.clues.map((c, i) => (
                        <li key={i}>· {c}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="font-typewriter text-sm font-bold uppercase border-b-2 border-stone-800 mb-4 pb-2">
              思想柜
            </h3>
            {state.thoughts.length === 0 ? (
              <p className="font-serif italic text-stone-500">还没有念头愿意在你体内定居。</p>
            ) : (
              <div className="space-y-3">
                {state.thoughts.map((thought) => (
                  <div key={thought.id} className="bg-white border border-stone-200 p-4 flex justify-between gap-4">
                    <div>
                      <div className="font-serif font-bold">{thought.title}</div>
                      <p className="text-sm text-stone-600 mt-1">{thought.description}</p>
                      <div className="font-typewriter text-[10px] mt-2 uppercase" style={{ color: SKILL_META[thought.skill].color }}>
                        内化后 {SKILL_META[thought.skill].name} +1
                      </div>
                    </div>
                    {thought.internalized ? (
                      <div className="font-typewriter text-xs uppercase text-emerald-800 shrink-0">已内化</div>
                    ) : (
                      <button
                        onClick={() => onInternalize(thought.id)}
                        className="shrink-0 self-start px-3 py-2 border border-stone-800 font-typewriter text-[10px] uppercase hover:bg-stone-800 hover:text-white"
                      >
                        内化 · 20分钟
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="font-typewriter text-sm font-bold uppercase border-b-2 border-stone-800 mb-4 pb-2">
              技能 · XP {state.xp}/{XP_PER_LEVEL}
              {state.pendingSkillPoints > 0 ? ` · 可分配 ${state.pendingSkillPoints}` : ''}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(SKILL_META) as SkillId[]).map((id) => (
                <button
                  key={id}
                  disabled={state.pendingSkillPoints <= 0}
                  onClick={() => onSpendPoint(id)}
                  className="bg-white border border-stone-200 p-3 text-left disabled:cursor-default hover:enabled:border-stone-800"
                >
                  <div className="font-typewriter text-[10px] uppercase text-stone-400">{SKILL_META[id].nameEn}</div>
                  <div className="font-bold" style={{ color: SKILL_META[id].color }}>
                    {SKILL_META[id].name} {skillValue(state, id)}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {state.checkLog.length > 0 && (
            <section>
              <h3 className="font-typewriter text-sm font-bold uppercase border-b-2 border-stone-800 mb-4 pb-2">
                检定记录
              </h3>
              <ul className="font-typewriter text-xs space-y-2 text-stone-600">
                {state.checkLog.slice().reverse().map((log, i) => (
                  <li key={i}>
                    [{log.time}] {SKILL_META[log.skill].name} {DIFFICULTY_LABEL[log.difficulty]}{' '}
                    {log.die1}+{log.die2}+{log.skillValue}={log.total}/{log.dc}{' '}
                    {log.success ? '成功' : '失败'} — {log.label}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseFile;
