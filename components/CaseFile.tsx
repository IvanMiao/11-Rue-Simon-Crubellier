import React from 'react';
import { DIFFICULTY_LABEL, SKILL_META, XP_PER_LEVEL } from '../constants/skills';
import { clockLabel, skillValue } from '../utils/gameLogic';
import { formatSeed } from '../utils/rng';
import { PlayerState, SkillId } from '../types';
import type { CaseGraph } from '../case/types';
import CaseBoard from './CaseBoard';

interface CaseFileProps {
  isOpen: boolean;
  onClose: () => void;
  state: PlayerState;
  caseGraph: CaseGraph | null;
  onInternalize: (thoughtId: string) => void;
  onSpendPoint: (skill: SkillId) => void;
  onPlaceCard: (slotId: string, cardId: string | null) => void;
  onCombine: (a: string, b: string) => void;
  onSubmitGroup: (groupId: string) => void;
}

const CaseFile: React.FC<CaseFileProps> = ({
  isOpen,
  onClose,
  state,
  caseGraph,
  onInternalize,
  onSpendPoint,
  onPlaceCard,
  onCombine,
  onSubmitGroup,
}) => {
  if (!isOpen) return null;

  const knownThreads = state.plotThreads.filter((t) => t.status !== 'unknown');
  const threadStatus: Record<string, string> = {
    active: '浮现',
    resolved: '已合拢',
    blocked: '尚未贯通',
  };

  return (
    <div className="case-file-scrim">
      <section className="case-file-sheet paper-sheet" role="dialog" aria-modal="true" aria-labelledby="case-file-title">
        <header className="case-file-header">
          <div>
            <div className="world-kicker">瓦莱纳的素描簿 · 案卷</div>
            <h2 id="case-file-title" className="world-title mt-1">已看见的东西</h2>
            <p className="case-file-meta">
              只收录你已经看见的东西 · {clockLabel(state.minutesPastEight)} · 种子 {formatSeed(state.runSeed)}
            </p>
          </div>
          <button onClick={onClose} aria-label="关闭案卷" className="world-button world-button-ghost min-h-11 min-w-11 !px-3 !py-2">
            关闭
          </button>
        </header>

        <div className="case-file-content">
          {caseGraph && state.case && (
            <CaseBoard
              graph={caseGraph}
              state={state.case}
              onPlaceCard={onPlaceCard}
              onCombine={onCombine}
              onSubmitGroup={onSubmitGroup}
            />
          )}
          <section className="case-file-section">
            <h3 className="world-kicker case-file-rule">已知线索</h3>
            {state.storyBible?.investigator_hook && (
              <div className="case-file-note">
                <div className="world-kicker">
                  委托
                </div>
                <p className="world-prose text-sm">
                  {state.storyBible.investigator_hook}
                </p>
              </div>
            )}
            {state.discoveredFacts.length === 0 ? (
              <p className="world-prose italic">案卷还是空的。去碰一碰那些不肯被列举的物件。</p>
            ) : (
              <ul className="space-y-3">
                {state.discoveredFacts.map((fact, i) => (
                  <li key={i} className="case-file-fact">
                    <span className="world-kicker">{String(i + 1).padStart(2, '0')}</span>
                    <span className="world-prose">{fact}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="case-file-section">
            <h3 className="world-kicker case-file-rule">情节线</h3>
            {knownThreads.length === 0 ? (
              <p className="world-prose italic">你还没有抓住任何一条线。楼里的故事在互相躲避。</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {knownThreads.map((thread) => (
                  <div key={thread.id} className="case-file-card">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-lg">{thread.title}</h4>
                      <span className="case-file-chip">
                        {threadStatus[thread.status] || thread.status}
                      </span>
                    </div>
                    <ul className="world-prose text-sm space-y-1">
                      {thread.clues.map((c, i) => (
                        <li key={i}>· {c}</li>
                      ))}
                    </ul>
                    {thread.rumors.length > 0 && (
                      <ul className="case-file-rumors">
                        {thread.rumors.map((rumor, i) => (
                          <li key={i}>· {rumor}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="case-file-section">
            <h3 className="world-kicker case-file-rule">
              思想柜
            </h3>
            {state.thoughts.length === 0 ? (
              <p className="world-prose italic">还没有念头愿意在你体内定居。</p>
            ) : (
              <div className="space-y-3">
                {state.thoughts.map((thought) => (
                  <div key={thought.id} className="case-file-card flex justify-between gap-4">
                    <div>
                      <div className="font-bold">{thought.title}</div>
                      <p className="world-prose text-sm mt-1">{thought.description}</p>
                      <div className="world-kicker mt-2" style={{ color: SKILL_META[thought.skill].color }}>
                        内化后 {SKILL_META[thought.skill].name} +1
                      </div>
                    </div>
                    {thought.internalized ? (
                      <div className="case-file-chip shrink-0">已内化</div>
                    ) : (
                      <button
                        onClick={() => onInternalize(thought.id)}
                        className="world-button world-button-ghost shrink-0 self-start !px-3 !py-2"
                      >
                        内化 · 20分钟
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="case-file-section">
            <h3 className="world-kicker case-file-rule">
              技能 · XP {state.xp}/{XP_PER_LEVEL}
              {state.pendingSkillPoints > 0 ? ` · 可分配 ${state.pendingSkillPoints}` : ''}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(SKILL_META) as SkillId[]).map((id) => (
                <button
                  key={id}
                  disabled={state.pendingSkillPoints <= 0}
                  onClick={() => onSpendPoint(id)}
                  className="case-file-card text-left disabled:cursor-default"
                >
                  <div className="world-kicker">{SKILL_META[id].nameEn}</div>
                  <div className="font-bold" style={{ color: SKILL_META[id].color }}>
                    {SKILL_META[id].name} {skillValue(state, id)}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {state.checkLog.length > 0 && (
            <section className="case-file-section">
              <h3 className="world-kicker case-file-rule">
                检定记录
              </h3>
              <ul className="case-file-log">
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
      </section>
    </div>
  );
};

export default CaseFile;
