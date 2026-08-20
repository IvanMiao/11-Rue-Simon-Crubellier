import React, { useEffect, useState } from 'react';
import { DIFFICULTY_LABEL, SKILL_META } from '../constants/skills';
import { SkillCheckResult } from '../types';

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

  useEffect(() => {
    if (!open || !rolling) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 80);
    return () => window.clearInterval(id);
  }, [open, rolling]);

  if (!open || !result) return null;

  const meta = SKILL_META[result.skill];
  const shown1 = rolling ? 1 + (tick % 6) : result.die1;
  const shown2 = rolling ? 1 + ((tick * 3) % 6) : result.die2;
  const shownTotal = shown1 + shown2 + result.skillValue;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#f4f1ea] w-full max-w-md border-4 border-stone-800 shadow-2xl p-8 text-center">
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

        <div className="flex justify-center gap-4 mb-6">
          {[shown1, shown2].map((d, i) => (
            <div
              key={i}
              className="w-16 h-16 bg-white border-2 border-stone-800 flex items-center justify-center font-typewriter text-3xl shadow-[4px_4px_0_0_rgba(28,25,23,1)]"
            >
              {d}
            </div>
          ))}
        </div>

        <p className="font-typewriter text-sm text-stone-600 mb-6">
          {shown1} + {shown2} + 技能 {result.skillValue} ={' '}
          <span className="font-bold text-stone-900">{shownTotal}</span>
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
              className="px-6 py-2 bg-stone-800 text-white font-typewriter text-xs uppercase tracking-widest"
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
