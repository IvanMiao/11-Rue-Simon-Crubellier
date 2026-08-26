import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from '../utils/motion';
import { buildingAudio } from '../services/audioEngine';
import {
  ARCHETYPES,
  DEFAULT_SKILLS,
  SKILL_MAX_AT_CREATE,
  SKILL_META,
  SKILL_MIN,
  SKILL_ORDER,
  SKILL_POINT_POOL,
} from '../constants/skills';
import { Character, SkillId } from '../types';

interface CharacterCreateProps {
  onBegin: (character: Character) => void;
}

const CharacterCreate: React.FC<CharacterCreateProps> = ({ onBegin }) => {
  const [name, setName] = useState('无名的列举者');
  const [archetypeId, setArchetypeId] = useState(ARCHETYPES[0].id);
  const [custom, setCustom] = useState(false);
  const [skills, setSkills] = useState(DEFAULT_SKILLS());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unlock = () => {
      void buildingAudio.unlock();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    if (!rootRef.current || prefersReducedMotion()) return () => window.removeEventListener('pointerdown', unlock);
    const ctx = gsap.context(() => {
      gsap.from('.create-block', {
        y: 16,
        opacity: 0,
        duration: 0.55,
        stagger: 0.08,
        ease: 'power2.out',
      });
    }, rootRef);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      ctx.revert();
    };
  }, []);

  const applyArchetype = (id: string) => {
    setArchetypeId(id);
    setCustom(false);
    const def = ARCHETYPES.find((a) => a.id === id)!;
    const next = DEFAULT_SKILLS();
    Object.entries(def.bonuses).forEach(([skill, bonus]) => {
      next[skill as SkillId] = SKILL_MIN + (bonus || 0);
    });
    setSkills(next);
  };

  const spent = useMemo(
    () => SKILL_ORDER.reduce((sum, id) => sum + (skills[id] - SKILL_MIN), 0),
    [skills]
  );
  const remaining = SKILL_POINT_POOL - spent;
  const archetype = ARCHETYPES.find((a) => a.id === archetypeId)!;

  const bump = (id: SkillId, delta: number) => {
    setCustom(true);
    setSkills((prev) => {
      const nextVal = prev[id] + delta;
      if (nextVal < SKILL_MIN || nextVal > SKILL_MAX_AT_CREATE) return prev;
      const currentSpent = SKILL_ORDER.reduce((sum, sid) => sum + (prev[sid] - SKILL_MIN), 0);
      if (currentSpent + delta > SKILL_POINT_POOL || currentSpent + delta < 0) return prev;
      return { ...prev, [id]: nextVal };
    });
  };

  const canBegin = remaining === 0 && name.trim().length > 0;

  return (
    <div ref={rootRef} className="min-h-screen w-screen overflow-y-auto bg-[#eae7dc] text-stone-900">
      <div className="max-w-5xl mx-auto px-4 py-10 md:py-16">
        <p className="create-block font-typewriter text-xs tracking-[0.35em] uppercase text-stone-500 mb-3">
          Run zero · 西蒙-克吕贝里埃街 11 号
        </p>
        <h1 className="create-block font-display text-4xl md:text-6xl font-bold mb-3">你是谁，在二十点整走进楼里？</h1>
        <p className="create-block font-serif text-lg text-stone-600 max-w-2xl leading-relaxed mb-10">
          这不是一次参观。每一局会重新编织住户的秘密。你带着八种互相顶嘴的能力，以及一盘只能走骑士跳的棋。午夜一到，时间恢复流动。
        </p>

        <label className="create-block block mb-10">
          <span className="font-typewriter text-xs uppercase tracking-widest text-stone-500">姓名</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full bg-white border border-stone-400 px-4 py-3 font-serif text-2xl focus:outline-none focus:border-stone-800"
          />
        </label>

        <div className="create-block grid md:grid-cols-3 gap-4 mb-12">
          {ARCHETYPES.map((arch) => {
            const selected = !custom && archetypeId === arch.id;
            return (
              <button
                key={arch.id}
                onClick={() => {
                  buildingAudio.ui();
                  applyArchetype(arch.id);
                }}
                className={`text-left p-5 border-2 transition ${
                  selected
                    ? 'bg-stone-800 text-[#f4f1ea] border-stone-800'
                    : 'bg-[#f4f1ea] border-stone-300 hover:border-stone-800'
                }`}
              >
                <div className="font-typewriter text-[10px] uppercase tracking-widest opacity-70 mb-2">
                  {arch.title}
                </div>
                <div className="font-serif text-2xl font-bold mb-3">{arch.name}</div>
                <p className={`text-sm leading-relaxed ${selected ? 'opacity-90' : 'text-stone-600'}`}>
                  {arch.blurb}
                </p>
              </button>
            );
          })}
        </div>

        <div className="create-block bg-[#f4f1ea] border border-stone-300 p-6 mb-8">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="font-serif text-2xl font-bold">技能配点</h2>
              <p className="font-typewriter text-xs text-stone-500 mt-1">
                {custom ? '自定义配点会覆盖原型。' : `当前原型：${archetype.name}`}
              </p>
            </div>
            <div className="font-typewriter text-sm">
              剩余点数 <span className="text-2xl font-bold">{remaining}</span> / {SKILL_POINT_POOL}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {SKILL_ORDER.map((id) => {
              const meta = SKILL_META[id];
              return (
                <div key={id} className="flex items-start gap-3 bg-white border border-stone-200 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold" style={{ color: meta.color }}>
                        {meta.name}
                      </span>
                      <span className="font-typewriter text-[10px] uppercase text-stone-400">
                        {meta.nameEn}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1 leading-snug">{meta.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        buildingAudio.ui();
                        bump(id, -1);
                      }}
                      className="w-8 h-8 border border-stone-400 font-typewriter hover:bg-stone-800 hover:text-white"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-typewriter text-lg">{skills[id]}</span>
                    <button
                      onClick={() => {
                        buildingAudio.ui();
                        bump(id, 1);
                      }}
                      className="w-8 h-8 border border-stone-400 font-typewriter hover:bg-stone-800 hover:text-white"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <blockquote className="font-serif italic text-stone-600 border-l-2 border-stone-400 pl-4 mb-10">
          {archetype.signatureThought}
        </blockquote>

        <button
          className="create-block px-8 py-4 bg-stone-800 text-[#f4f1ea] font-typewriter uppercase tracking-[0.2em] text-sm disabled:opacity-40 hover:bg-stone-700"
          disabled={!canBegin}
          onClick={() => {
            void buildingAudio.unlock();
            buildingAudio.weave();
            onBegin({
              name: name.trim(),
              archetype: custom ? `${archetype.name}（改写）` : archetype.name,
              skills,
              signatureThought: archetype.signatureThought,
            });
          }}
        >
          进入冻结的二十点
        </button>
      </div>
    </div>
  );
};

export default CharacterCreate;
