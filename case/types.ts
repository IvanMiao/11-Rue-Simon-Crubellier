import type {
  CheckDifficulty,
  CheckKind,
  SkillId,
  StoryBible,
  ThoughtSeed,
} from '../types';

export type LiarId = 'p-nochere' | 'p-smautf' | 'p-valene';

export type CardKind =
  | 'person'
  | 'shape'
  | 'place'
  | 'object'
  | 'testimony'
  | 'time'
  | 'word';

export interface CaseCard {
  id: string;
  kind: CardKind;
  label: string;
}

export interface CaseSlot {
  id: string;
  groupId: string;
  prompt: string;
  accepts: CardKind[];
  answer: string;
}

export interface CaseGroup {
  id: 'A' | 'B' | 'C';
  title: string;
  slots: CaseSlot[];
}

export interface CaseEvidence {
  id: string;
  roomId: string;
  kind: 'look' | 'check';
  label: string;
  cards: string[];
  grantsNotebook?: boolean;
  availableFrom?: number;
  requiresItem?: string;
  failCards?: string[];
  text?: string;
  successText?: string;
  failureText?: string;
  skill?: SkillId;
  difficulty?: CheckDifficulty;
  checkKind?: CheckKind;
}

export interface CaseItem {
  id: string;
  name: string;
  description: string;
  roomId: string;
}

export interface CaseHourPage {
  minute: 60 | 120 | 180;
  hour: 21 | 22 | 23;
  title: string;
  text: string;
  roomIds: string[];
}

export interface CaseThought extends ThoughtSeed {
  effect: 'knight' | 'catalogue' | 'steam';
}

export interface CaseRecipe {
  id: string;
  pair: [string, string];
  cards: string[];
  text: string;
}

export interface CaseGraph {
  seed: number;
  liar: LiarId;
  handSkill: 'perception' | 'logic';
  cards: CaseCard[];
  groups: CaseGroup[];
  slots: CaseSlot[];
  evidence: CaseEvidence[];
  recipes: CaseRecipe[];
}

export interface CaseState {
  liar: LiarId;
  handSkill: 'perception' | 'logic';
  notebook: boolean;
  cards: string[];
  cardSources: Record<string, CardSource>;
  takenEvidence: string[];
  usedRecipes: string[];
  slots: Record<string, string | null>;
  lockedGroups: string[];
  wrongSubmissions: number;
  retryMarks: Record<string, number>;
  pondered: Record<string, string>;
  notes: string[];
  grade?: number;
}

export interface CardSource {
  via: 'look' | 'check' | 'checkFail' | 'recipe';
  cellId: string;
  evidenceId?: string;
  recipeId?: string;
  minute: number;
}

export interface CaseBible extends StoryBible {}
