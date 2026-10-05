import React, { useState } from 'react';
import { ARCHETYPES, DEFAULT_SKILLS, SKILL_META, SKILL_MIN } from '../../constants/skills';
import { Character, SkillId } from '../../types';
import { CLINAMEN_CELL, CELLS } from '../../world/damier';
import DamierCanvas from './DamierCanvas';

interface AtelierProps {
  onBegin: (character: Character) => void;
}

function characterFor(archetypeId: string): Character {
  const def = ARCHETYPES.find((a) => a.id === archetypeId) || ARCHETYPES[0];
  const skills = DEFAULT_SKILLS();
  Object.entries(def.bonuses).forEach(([skill, bonus]) => {
    skills[skill as SkillId] = SKILL_MIN + (bonus || 0);
  });
  return { name: '读者', archetype: def.name, skills, signatureThought: def.signatureThought };
}

/** Valène's studio: the blank charcoal canvas, and the choice of how to read it. */
const Atelier: React.FC<AtelierProps> = ({ onBegin }) => {
  const [step, setStep] = useState<'canvas' | 'reading'>('canvas');
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="world-desk min-h-screen w-screen overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 grid md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] gap-8 items-start">
        <div className="relative">
          <DamierCanvas
            cells={CELLS}
            visited={new Set()}
            clinamenId={CLINAMEN_CELL}
            hour={20}
            className="paper-sheet"
          />
          <p className="world-caption mt-3">
            瓦莱纳的画布 · 一百个格子 · 只有炭笔
          </p>
        </div>

        <div className="world-card p-6 md:p-8">
          <p className="world-kicker">11, rue Simon-Crubellier · 1975 年 6 月 23 日 · 20:00</p>
          {step === 'canvas' ? (
            <>
              <h1 className="world-title mt-4">一张没有画完的画</h1>
              <div className="world-prose mt-5 space-y-4">
                <p>
                  老画家瓦莱纳死的时候，画布上只有炭笔打好的方格：一栋被剖开的楼，十层，每层十格，每一格是一间房。
                </p>
                <p>
                  他想把楼里每个人都画进去，停在二十点整之前的那一刻。三楼的巴特尔布思刚刚死在第 439 幅拼图前，手里攥着一块放不进去的拼图。
                </p>
                <p>
                  你从第 1 章开始：三楼的楼梯平台。走进哪一格，那一格才会上色。
                </p>
              </div>
              <button className="world-button mt-8 w-full" onClick={() => setStep('reading')}>
                翻开画布
              </button>
            </>
          ) : (
            <>
              <h1 className="world-title mt-4">你怎样读这栋楼？</h1>
              <p className="world-prose mt-3 text-sm">读法决定你最擅长哪几种检定。案件不靠检定也能解开，检定只是捷径。</p>
              <div className="mt-6 space-y-3">
                {ARCHETYPES.map((a) => (
                  <button
                    key={a.id}
                    className="world-choice w-full text-left"
                    onMouseEnter={() => setHover(a.id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onBegin(characterFor(a.id))}
                  >
                    <span className="world-choice-title">{a.name}</span>
                    <span className="world-choice-sub">{a.title}</span>
                    <span className="world-choice-skills">
                      {Object.entries(a.bonuses)
                        .sort((x, y) => (y[1] || 0) - (x[1] || 0))
                        .map(([skill, bonus]) => `${SKILL_META[skill as SkillId].name} ${SKILL_MIN + (bonus || 0)}`)
                        .join(' · ')}
                    </span>
                    {hover === a.id && <span className="world-choice-blurb">{a.blurb}</span>}
                  </button>
                ))}
              </div>
              <p className="world-footnote mt-6">选好后，你会站在三楼的楼梯平台上，第 I 章。</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Atelier;
