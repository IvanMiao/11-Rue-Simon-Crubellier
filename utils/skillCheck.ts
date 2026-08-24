import { DIFFICULTY_DC } from '../constants/skills';
import { CheckDifficulty, CheckKind, SkillCheckResult, SkillId } from '../types';
import { hashString, mulberry32, rollDie } from './rng';

export function performSkillCheck(opts: {
  skill: SkillId;
  skillValue: number;
  difficulty: CheckDifficulty;
  kind?: CheckKind;
  seed: number;
  salt: string;
}): SkillCheckResult {
  const rng = mulberry32(opts.seed ^ hashString(opts.salt));
  const die1 = rollDie(rng);
  const die2 = rollDie(rng);
  const dc = DIFFICULTY_DC[opts.difficulty];
  const total = die1 + die2 + opts.skillValue;
  return {
    success: total >= dc,
    die1,
    die2,
    skillValue: opts.skillValue,
    total,
    dc,
    skill: opts.skill,
    difficulty: opts.difficulty,
    kind: opts.kind || 'white',
  };
}

export function interactionKey(roomId: string, interactionId: string): string {
  return `${roomId}::${interactionId}`;
}

export function effectiveSkill(
  base: number,
  internalizedBonus: number
): number {
  return Math.max(1, base + internalizedBonus);
}
