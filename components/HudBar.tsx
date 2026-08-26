import React, { useEffect, useState } from 'react';
import { SKILL_META } from '../constants/skills';
import { clockLabel } from '../utils/gameLogic';
import { formatSeed } from '../utils/rng';
import { PlayerState, SkillId } from '../types';

interface HudBarProps {
  state: PlayerState;
  muted: boolean;
  onToggleMute: () => void;
  onOpenCase: () => void;
  onOpenSheet: () => void;
  onReset: () => void;
  onToggleMap: () => void;
  isMobileMapOpen: boolean;
}

const HudBar: React.FC<HudBarProps> = ({
  state,
  muted,
  onToggleMute,
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
  const [prevMorale, setPrevMorale] = useState(state.morale);
  const lost = state.morale < prevMorale;

  useEffect(() => {
    setPrevMorale(state.morale);
  }, [state.morale]);

  const btn =
    'font-typewriter text-[10px] px-2.5 py-1 border border-[#8a7c6a] text-[#e8dcc8] hover:bg-[#3a3228] uppercase tracking-widest';

  return (
    <nav className="hud-archive h-14 flex items-center justify-between px-3 md:px-4 z-30 shrink-0 gap-2">
      <button onClick={onOpenSheet} className="flex items-center gap-2 min-w-0 text-left">
        <span className="font-display font-semibold text-lg md:text-xl truncate tracking-wide">
          {state.character?.name || "La Vie mode d'emploi"}
        </span>
        <span className="hidden md:inline font-typewriter text-[10px] text-[#b8a078] border border-[#5a4a32] px-1.5 py-0.5">
          {state.character?.archetype}
        </span>
      </button>

      <div className="flex items-center gap-3 md:gap-5 font-typewriter text-xs text-[#e8dcc8]">
        <div className="text-center">
          <div className="text-[9px] text-[#b8a078] uppercase tracking-widest">时间</div>
          <div className="font-bold tabular-nums">{clockLabel(state.minutesPastEight)}</div>
        </div>
        <div className="text-center hidden sm:block">
          <div className="text-[9px] text-[#b8a078] uppercase tracking-widest">意志</div>
          <div className="flex gap-0.5 justify-center mt-0.5">
            {moralePips.map((on, i) => (
              <span
                key={i}
                className={`hud-pip inline-block w-2.5 h-2.5 rotate-45 ${
                  on ? 'is-on' : 'bg-[#3a3228]'
                } ${lost && !on && i === state.morale ? 'is-lost' : ''}`}
              />
            ))}
          </div>
        </div>
        {topSkill && (
          <div className="hidden lg:block text-center">
            <div className="text-[9px] text-[#b8a078] uppercase tracking-widest">主技能</div>
            <div style={{ color: SKILL_META[topSkill[0] as keyof typeof SKILL_META].color }}>
              {SKILL_META[topSkill[0] as keyof typeof SKILL_META].name} {topSkill[1]}
            </div>
          </div>
        )}
        <div className="hidden md:block text-[#8a7c6a] tracking-widest">
          SEED {formatSeed(state.runSeed)}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {state.pendingSkillPoints > 0 && (
          <button onClick={onOpenSheet} className={`${btn} border-[#c4a05a] text-[#f0d78c]`}>
            +{state.pendingSkillPoints} 点
          </button>
        )}
        <button onClick={onToggleMute} className={btn} title={muted ? '打开声音' : '静音'}>
          {muted ? '静音' : '声响'}
        </button>
        <button onClick={onOpenCase} className={btn}>
          案卷
        </button>
        <button onClick={onReset} className="hidden md:inline font-typewriter text-[10px] text-[#d4a090] hover:underline uppercase tracking-widest">
          放弃此局
        </button>
        <button onClick={onToggleMap} className={`md:hidden ${btn}`}>
          {isMobileMapOpen ? '阅读' : '剖面'}
        </button>
      </div>
    </nav>
  );
};

export default HudBar;
