import {
  Character,
  InventoryItem,
  NarrativeResponse,
  RunStatus,
  SkillCheckResult,
  SkillId,
  StoryBible,
} from '../types';

export type Action =
  | { type: 'startRun'; character: Character; seed: number; bible: StoryBible }
  | { type: 'roomContent'; roomId: string; content: NarrativeResponse }
  | { type: 'move'; roomId: string }
  | { type: 'collect'; itemId: string }
  | { type: 'interact'; interactionId: string }
  | { type: 'placeCard'; slotId: string; cardId: string | null }
  | { type: 'combine'; a: string; b: string }
  | { type: 'submitGroup'; groupId: string }
  | { type: 'internalize'; thoughtId: string }
  | { type: 'spendPoint'; skill: SkillId };

export type GameEvent =
  | { type: 'moved'; from: string | null; to: string; kind: 'walk' | 'knight' | 'elevator'; minutes: number }
  | { type: 'needsRoomContent'; roomId: string }
  | { type: 'checkRolled'; roomId: string; interactionId: string; label: string; result: SkillCheckResult; body: string }
  | { type: 'interacted'; roomId: string; interactionId: string; text: string }
  | { type: 'clueFound'; clue: string }
  | { type: 'cardsFound'; cards: string[]; text: string }
  | { type: 'combined'; recipeId: string | null; text: string }
  | { type: 'groupLocked'; groupId: string }
  | { type: 'groupRejected'; groupId: string }
  | { type: 'itemCollected'; item: InventoryItem }
  | { type: 'thoughtInternalized'; thoughtId: string }
  | { type: 'runEnded'; status: RunStatus }
  | { type: 'rejected'; action: Action['type']; reason: string };
