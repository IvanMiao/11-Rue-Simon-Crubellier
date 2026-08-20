export interface RoomData {
  id: string;
  name: string; // The name on the map (e.g., BARTLEBOOTH)
  floor: number; // 0-8, -1 for caves
  description?: string; // Static fallback description
  colSpan?: number; // For grid layout logic
  rowSpan?: number;
  type: 'apartment' | 'service' | 'stairwell' | 'elevator' | 'basement';
}

export type SkillId =
  | 'perception'
  | 'logic'
  | 'encyclopedia'
  | 'empathy'
  | 'inland'
  | 'shivers'
  | 'rhetoric'
  | 'constraint';

export type CheckDifficulty =
  | 'trivial'
  | 'easy'
  | 'medium'
  | 'challenging'
  | 'formidable'
  | 'legendary';

export type CheckKind = 'white' | 'red';

export type RunStatus =
  | 'creating'
  | 'generating'
  | 'playing'
  | 'collapsed'
  | 'midnight'
  | 'solved';

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  type?: 'regular' | 'puzzle_piece';
}

export interface InnerVoice {
  skill: SkillId;
  text: string;
}

export interface Interaction {
  id?: string;
  label: string;
  response: string;
  type?: 'dialogue' | 'action' | 'check';
  skill?: SkillId;
  difficulty?: CheckDifficulty;
  kind?: CheckKind;
  success_response?: string;
  failure_response?: string;
  plot_flag?: string;
  clue?: string;
  morale_on_success?: number;
  morale_on_fail?: number;
  resolves_mystery?: boolean;
}

export interface PlotUpdate {
  thread_id: string;
  clue: string;
}

export interface ThoughtSeed {
  id: string;
  title: string;
  description: string;
  skill: SkillId;
}

export interface NarrativeResponse {
  text: string;
  items: string[];
  mood: string;
  puzzle_hint?: string;
  collectible_item?: InventoryItem;
  available_interactions?: Interaction[];
  inner_voices?: InnerVoice[];
  npcs_present?: string[];
  plot_updates?: PlotUpdate[];
  offered_thought?: ThoughtSeed;
  journal?: string[];
  consumed_interaction_ids?: string[];
}

export enum GameState {
  IDLE = 'IDLE',
  NAVIGATING = 'NAVIGATING',
  EXPLORING = 'EXPLORING',
  INSPECTING = 'INSPECTING',
}

export interface StoryCharacter {
  name: string;
  role: string;
  secret: string;
  home_room?: string;
}

export interface StoryPlotThread {
  id: string;
  title: string;
  summary: string;
  stages: string[];
}

export interface StoryBible {
  title: string;
  themes: string[];
  key_characters: StoryCharacter[];
  plot_threads: StoryPlotThread[];
  mystery: string;
  investigator_hook: string;
  thoughts?: ThoughtSeed[];
}

export interface Character {
  name: string;
  archetype: string;
  skills: Record<SkillId, number>;
  signatureThought: string;
}

export interface PlotThreadState {
  id: string;
  title: string;
  summary: string;
  status: 'unknown' | 'rumored' | 'active' | 'resolved';
  clues: string[];
}

export interface Thought {
  id: string;
  title: string;
  description: string;
  skill: SkillId;
  internalized: boolean;
}

export interface CheckLogEntry {
  roomId: string;
  label: string;
  skill: SkillId;
  difficulty: CheckDifficulty;
  kind: CheckKind;
  die1: number;
  die2: number;
  skillValue: number;
  total: number;
  dc: number;
  success: boolean;
  time: string;
}

export interface SkillCheckResult {
  success: boolean;
  die1: number;
  die2: number;
  skillValue: number;
  total: number;
  dc: number;
  skill: SkillId;
  difficulty: CheckDifficulty;
  kind: CheckKind;
}

export interface PlayerState {
  version: number;
  runSeed: number;
  runStatus: RunStatus;
  character?: Character;
  minutesPastEight: number;
  morale: number;
  maxMorale: number;
  currentRoomId: string | null;
  visitedRooms: Record<string, NarrativeResponse>;
  resolvedChecks: Record<string, boolean>;
  attemptedRedChecks: string[];
  storyBible?: StoryBible;
  inventory: InventoryItem[];
  puzzlePiecesCollected: number;
  lastMoveWasKnightMove: boolean;
  lastMoveWasWalk: boolean;
  lastMoveKind: 'walk' | 'knight' | 'elevator';
  plotThreads: PlotThreadState[];
  thoughts: Thought[];
  discoveredFacts: string[];
  checkLog: CheckLogEntry[];
  xp: number;
  pendingSkillPoints: number;
  roomsVisitedCount: number;
}

export interface ArchetypeDef {
  id: string;
  name: string;
  title: string;
  blurb: string;
  signatureThought: string;
  bonuses: Partial<Record<SkillId, number>>;
}
