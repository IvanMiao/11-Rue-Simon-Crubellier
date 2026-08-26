import { Character, NarrativeResponse, RoomData } from '../types';
import { fallbackRoom } from './fallbackContent';
import { ReachableMap } from './gridLogic';

export function skeletonForRoom(
  room: RoomData,
  seed: number,
  character?: Character,
  isKnightMove?: boolean
): NarrativeResponse {
  return {
    ...fallbackRoom(room.id, room.name, seed, character, isKnightMove),
    source: 'skeleton',
  };
}

export function roomWasActedOn(room: NarrativeResponse): boolean {
  return Boolean(room.journal?.length || room.consumed_interaction_ids?.length);
}

export function upgradeRoomContent(
  previous: NarrativeResponse,
  authored: NarrativeResponse
): NarrativeResponse {
  const next: NarrativeResponse = {
    ...authored,
    source: 'authored',
    journal: previous.journal,
    consumed_interaction_ids: previous.consumed_interaction_ids,
  };

  if (roomWasActedOn(previous)) {
    next.available_interactions = previous.available_interactions;
    next.collectible_item = previous.collectible_item;
    next.items = previous.items?.length ? previous.items : authored.items;
    if (previous.inner_voices?.length) next.inner_voices = previous.inner_voices;
  }
  if (previous.collectible_taken) {
    next.collectible_item = undefined;
    next.collectible_taken = true;
  }

  return next;
}

export function roomsToPrefetch(
  reachable: ReachableMap,
  currentRoomId: string | null,
  visited: Record<string, NarrativeResponse>,
  limit = 6
): string[] {
  const ordered = [...reachable.walk, ...reachable.knight, ...reachable.elevator];
  const unique: string[] = [];
  for (const id of ordered) {
    if (id === currentRoomId) continue;
    if (unique.includes(id)) continue;
    if (visited[id]) continue;
    unique.push(id);
    if (unique.length >= limit) break;
  }
  return unique;
}

export function moveKindForPrefetch(
  reachable: ReachableMap,
  id: string
): 'walk' | 'knight' | 'elevator' {
  if (reachable.knight.has(id)) return 'knight';
  if (reachable.elevator.has(id) && !reachable.walk.has(id)) return 'elevator';
  return 'walk';
}
