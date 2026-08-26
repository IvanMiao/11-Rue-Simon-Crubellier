import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { DIFFICULTY_LABEL, SKILL_META } from '../constants/skills';
import { SkillCheckResult } from '../types';
import { prefersReducedMotion } from '../utils/motion';
import { buildingAudio } from '../services/audioEngine';

interface SkillCheckModalProps {
  open: boolean;
  label: string;
  result: SkillCheckResult | null;
  rolling: boolean;
  onFinished: () => void;
}

const SkillCheckModal: React.FC<SkillCheckModalProps> = ({
  open,
  label,
  result,
  rolling,
  onFinished,
}) => {
  const [tick, setTick] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const diceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !rolling) return;
    buildingAudio.diceRoll();
    const id = window.setInterval(() => setTick((t) => t + 1), 80);
    return () => window.clearInterval(id);
  }, [open, rolling]);

  useEffect(() => {
    if (!open || rolling || !result) return;
    buildingAudio.diceLand();
    if (result.success) buildingAudio.success();
    else buildingAudio.fail();
  }, [open, rolling, result]);

  useLayoutEffect(() => {
    if (!open || !cardRef.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { y: 18, opacity: 0, scale: 0.96 },
        { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' }
      );
    }, cardRef);
    return () => ctx.revert();
  }, [open]);

  useLayoutEffect(() => {
    if (!diceRef.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      if (rolling) {
        gsap.to('.die-face', {
          rotate: 14,
          y: -5,
          duration: 0.07,
          repeat: -1,
          yoyo: true,
          ease: 'none',
          stagger: 0.03,
        });
      } else {
        gsap.killTweensOf('.die-face');
        gsap.fromTo(
          '.die-face',
          { y: -12, rotate: -12 },
          { y: 0, rotate: 0, duration: 0.45, ease: 'back.out(2)', stagger: 0.06 }
        );
      }
    }, diceRef);
    return () => ctx.revert();
  }, [rolling, open]);

  if (!open || !result) return null;

  const meta = SKILL_META[result.skill];
  const shown1 = rolling ? 1 + (tick % 6) : result.die1;
  const shown2 = rolling ? 1 + ((tick * 3) % 6) : result.die2;
  const shownTotal = shown1 + shown2 + result.skillValue;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 check-veil p-4">
      <div
        ref={cardRef}
        className="check-modal w-full max-w-md shadow-2xl p-8 text-center"
      >
        <div className="font-typewriter text-[10px] tracking-[0.35em] uppercase text-stone-500 mb-2">
          {result.kind === 'red' ? '红色检定 · 仅一次' : '白色检定 · 可再试'}
        </div>
        <h2 className="font-serif text-3xl font-bold mb-1" style={{ color: meta.color }}>
          {meta.name}
        </h2>
        <p className="font-typewriter text-xs uppercase tracking-widest text-stone-500 mb-6">
          {meta.nameEn} · {DIFFICULTY_LABEL[result.difficulty]} DC {result.dc}
        </p>
        <p className="font-serif italic text-stone-700 mb-8">{label}</p>

        <div ref={diceRef} className="flex justify-center gap-4 mb-6">
          {[shown1, shown2].map((d, i) => (
            <div
              key={i}
              className={`die-face w-16 h-16 border-2 border-stone-800 flex items-center justify-center font-typewriter text-3xl shadow-[4px_4px_0_0_rgba(28,25,23,1)] ${
                !rolling ? 'is-settling' : ''
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        <p className="font-typewriter text-sm text-stone-600 mb-6">
          {shown1} + {shown2} + 技能 {result.skillValue} ={' '}
          <span className="font-bold text-stone-900">{shownTotal}</span>
          <span className="text-stone-400"> / {result.dc}</span>
        </p>

        {!rolling && (
          <>
            <div
              className={`font-serif text-2xl font-bold mb-6 ${
                result.success ? 'text-emerald-800' : 'text-red-800'
              }`}
            >
              {result.success ? '成功' : '失败'}
            </div>
            <button
              onClick={onFinished}
              className="px-6 py-2 bg-stone-800 text-white font-typewriter text-xs uppercase tracking-widest hover:bg-stone-700"
            >
              继续
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SkillCheckModal;
