import type { GameEvent } from '../engine/types';
import { CASE_APARTMENT_PASSAGES, CASE_ROOM_IDS } from '../case/caseData';
import { moveTimeline } from '../art/stage/motion';
import { CELLS, CLINAMEN_CELL } from '../world/damier';
import type { Cue } from './cues';

export interface CueRequest {
  cue: Cue;
  key: string;
  delayMs?: number;
  gainDbOffset?: number;
  durationMs?: number;
}

const authoredCaseCells = new Set<string>(CASE_ROOM_IDS);
CELLS.forEach((cell) => {
  if (CASE_APARTMENT_PASSAGES[cell.apartmentId]) authoredCaseCells.add(cell.id);
});

export function cuesForGameEvents(
  events: readonly GameEvent[],
  previouslyVisited: Readonly<Record<string, unknown>>,
  actionKey = 'action'
): CueRequest[] {
  const cues: CueRequest[] = [];
  let addsContent = false;
  let contentDelay = 0;

  events.forEach((event, eventIndex) => {
    const key = `${actionKey}:${eventIndex}:${event.type}`;
    if (event.type === 'moved') {
      const from = event.from || event.to;
      const duration = moveTimeline([from, event.to], event.kind).duration;
      if (event.kind === 'walk') {
        cues.push(
          { cue: 'step.wood', key: `${key}:step-a`, delayMs: Math.round(duration * 0.2) },
          { cue: 'step.wood', key: `${key}:step-b`, delayMs: Math.round(duration * 0.72) }
        );
      } else if (event.kind === 'knight') {
        cues.push(
          {
            cue: 'knight.land',
            key: `${key}:corner`,
            delayMs: Math.round(duration / 2),
            gainDbOffset: -6,
          },
          { cue: 'knight.land', key: `${key}:arrival`, delayMs: duration }
        );
      } else {
        cues.push(
          { cue: 'lift.gate', key: `${key}:depart` },
          { cue: 'lift.cable', key: `${key}:cable`, durationMs: duration },
          { cue: 'lift.gate', key: `${key}:arrive`, delayMs: duration },
          { cue: 'step.wood', key: `${key}:step`, delayMs: duration + 160 }
        );
      }
      if (authoredCaseCells.has(event.to) && !previouslyVisited[event.to]) {
        cues.push({ cue: 'music.chapter', key: `${actionKey}:chapter:${event.to}` });
      }
      if (event.to === CLINAMEN_CELL && !previouslyVisited[event.to]) {
        cues.push({ cue: 'music.clinamen', key: `${actionKey}:clinamen` });
      }
    } else if (event.type === 'hourTurned') {
      cues.push({ cue: 'hour.bell', key: `${key}:${event.hour}` });
    } else if (event.type === 'checkRolled') {
      cues.push(
        { cue: 'dice.shake', key: `${key}:shake` },
        { cue: 'dice.throw', key: `${key}:throw`, delayMs: 960 }
      );
      if (event.result.success) cues.push({ cue: 'pencil.tick', key: `${key}:tick`, delayMs: 960 });
      contentDelay = 960;
    } else if (event.type === 'cardsFound' && event.cards.length > 0) {
      addsContent = true;
    } else if (event.type === 'itemCollected') {
      addsContent = true;
      cues.push({ cue: 'pencil.tick', key: `${key}:tick` });
    } else if (event.type === 'combined') {
      if (event.recipeId === null) cues.push({ cue: 'drop.nothing', key: `${key}:failed` });
      else addsContent = true;
    } else if (event.type === 'interacted') {
      cues.push({ cue: 'pencil.tick', key: `${key}:${event.interactionId}` });
    } else if (event.type === 'runEnded' && event.status === 'solved') {
      cues.push({ cue: 'music.solved', key: `${actionKey}:solved` });
    }
  });

  if (addsContent) {
    cues.push(
      { cue: 'paper.peel', key: `${actionKey}:content:peel`, delayMs: contentDelay },
      { cue: 'paper.land', key: `${actionKey}:content:land`, delayMs: contentDelay + 680 }
    );
  }
  return cues;
}
