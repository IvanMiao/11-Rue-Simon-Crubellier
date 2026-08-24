import React from 'react';
import { SKILL_META } from '../constants/skills';
import { clockLabel } from '../utils/gameLogic';
import { formatSeed } from '../utils/rng';
import { PlayerState, SkillId } from '../types';

interface HudBarProps {
  state: PlayerState;
  onOpenCase: () => void;
  onOpenSheet: () => void;
  onReset: () => void;
  onToggleMap: () => void;
  isMobileMapOpen: boolean;
}

const HudBar: React.FC<HudBarProps> = ({
  state,
  onOpenCase,
  onOpenSheet,
  onReset,
  onToggleMap,
  isMobileMapOpen,
}) => {
  const moralePips = Array.from({ length: state.maxMorale }, (_, i) => i < state.morale);
  const topSkill = state.character
    ? (Object.entries(state.character.skills) as [SkillId, number][]).sort((a, b) => b[1] - a[1])[0]
    : null;

  return (
    <nav className="h-14 flex items-center justify-between px-3 md:px-4 bg-white border-b border-stone-300 z-30 shrink-0 shadow-sm gap-2">
      <button onClick={onOpenSheet} className="flex items-center gap-2 min-w-0 text-left">
        <span className="font-serif font-bold text-base md:text-lg truncate">
          {state.character?.name || 'La Vie mode d\'emploi'}
        </span>
        <span className="hidden md:inline font-typewriter text-[10px] text-stone-400 border border-stone-200 px-1 rounded">
          {state.character?.archetype}
        </span>
      </button>

      <div className="flex items-center gap-3 md:gap-4 font-typewriter text-xs">
        <div className="text-center">
          <div className="text-[10px] text-stone-400 uppercase tracking-widest">时间</div>
          <div className="font-bold">{clockLabel(state.minutesPastEight)}</div>
        </div>
        <div className="text-center hidden sm:block">
          <div className="text-[10px] text-stone-400 uppercase tracking-widest">意志</div>
          <div className="flex gap-0.5 justify-center mt-0.5">
            {moralePips.map((on, i) => (
              <span
                key={i}
                className={`inline-block w-2.5 h-2.5 rotate-45 ${on ? 'bg-stone-800' : 'bg-stone-200'}`}
              />
            ))}
          </div>
        </div>
        {topSkill && (
          <div className="hidden lg:block text-center">
            <div className="text-[10px] text-stone-400 uppercase tracking-widest">主技能</div>
            <div style={{ color: SKILL_META[topSkill[0] as keyof typeof SKILL_META].color }}>
              {SKILL_META[topSkill[0] as keyof typeof SKILL_META].name} {topSkill[1]}
            </div>
          </div>
        )}
        <div className="hidden md:block text-stone-400">
          SEED {formatSeed(state.runSeed)}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {state.pendingSkillPoints > 0 && (
          <button
            onClick={onOpenSheet}
            className="font-typewriter text-[10px] px-2 py-1 bg-amber-100 border border-amber-700 text-amber-800 uppercase"
          >
            +{state.pendingSkillPoints} 点
          </button>
        )}
        <button
          onClick={onOpenCase}
          className="font-typewriter text-xs px-3 py-1 border border-stone-400 rounded hover:bg-stone-100 text-stone-600 uppercase tracking-wider"
        >
          案卷
        </button>
        <button
          onClick={onReset}
          className="hidden md:inline font-typewriter text-xs text-red-800 hover:underline uppercase"
        >
          放弃此局
        </button>
        <button
          onClick={onToggleMap}
          className="md:hidden font-typewriter text-xs px-3 py-1 border border-stone-800 rounded"
        >
          {isMobileMapOpen ? '阅读' : '地图'}
        </button>
      </div>
    </nav>
  );
};

export default HudBar;
