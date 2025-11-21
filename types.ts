export interface RoomData {
  id: string;
  name: string; // The name on the map (e.g., BARTLEBOOTH)
  floor: number; // 0-8, -1 for caves
  description?: string; // Static fallback description
  colSpan?: number; // For grid layout logic
  rowSpan?: number;
  type: 'apartment' | 'service' | 'stairwell' | 'elevator' | 'basement';
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  type?: 'regular' | 'puzzle_piece';
}

export interface Interaction {
  label: string; // The text on the button, e.g. "Open the drawer"
  response: string; // The immediate result text
  type?: 'dialogue' | 'action';
}

export interface NarrativeResponse {
  text: string;
  items: string[];
  mood: string;
  puzzle_hint?: string;
  collectible_item?: InventoryItem;
  available_interactions?: Interaction[];
}

export enum GameState {
  IDLE = 'IDLE',
  NAVIGATING = 'NAVIGATING', // Looking at the map
  EXPLORING = 'EXPLORING',   // Reading a room description
  INSPECTING = 'INSPECTING', // Looking at a specific item
}

export interface StoryBible {
  title: string;
  themes: string[];
  key_characters: { name: string; role: string; secret: string }[];
  plot_threads: string[];
  mystery: string;
}

export interface PlayerState {
  visitedRooms: Record<string, NarrativeResponse>;
  storyBible?: StoryBible;
  inventory: InventoryItem[];
  puzzlePiecesCollected: number;
  lastMoveWasKnightMove: boolean;
}
