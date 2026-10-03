import { NarrativeResponse, StoryBible } from '../types';
import {
  CASE_ALIBI_RECIPE,
  CASE_CARDS,
  CASE_CHARACTER_ROOMS,
  CASE_EVIDENCE_TEMPLATES,
  CASE_GROUP_TEMPLATES,
  CASE_LIAR_IDS,
  CASE_LIAR_VARIANTS,
  CASE_RECIPE_TEMPLATES,
  CASE_ROOM_DESCRIPTIONS,
  CASE_ROOM_IDS,
  CASE_SLOT_TEMPLATES,
} from './caseData';
import {
  CaseEvidence,
  CaseGraph,
  CaseGroup,
  CaseRecipe,
  CaseSlot,
  LiarId,
} from './types';
import { FALLBACK_BIBLE, FINALE_INTERACTION } from '../utils/fallbackContent';
import { hashString, mulberry32, pickIndex } from '../utils/rng';

export { CASE_ROOM_IDS };
export type { CaseBible, CaseCard, CaseGraph, CaseGroup, CaseSlot, LiarId } from './types';

export function buildCase(seed: number): CaseGraph {
  const rng = mulberry32(seed ^ hashString('case-439'));
  const liar = CASE_LIAR_IDS[pickIndex(rng, CASE_LIAR_IDS.length)];
  const handSkill = pickIndex(rng, 2) === 0 ? 'perception' : 'logic';
  const variant = CASE_LIAR_VARIANTS[liar];
  const cards = CASE_CARDS.map((card) => ({ ...card }));
  const slots: CaseSlot[] = CASE_SLOT_TEMPLATES.map((template) => ({
    ...template,
    accepts: [...template.accepts],
    answer:
      template.answer === 'liar'
        ? liar
        : template.answer === 'true-place'
          ? variant.truePlace
          : template.answer === 'proof-object'
            ? variant.proofObject
            : template.answer,
  }));
  const groups: CaseGroup[] = CASE_GROUP_TEMPLATES.map((template) => ({
    ...template,
    slots: template.slotIds.map((slotId) => slots.find((slot) => slot.id === slotId)!),
  }));
  const evidence: CaseEvidence[] = CASE_EVIDENCE_TEMPLATES.map((template) => ({
    id: template.id,
    roomId: template.roomId,
    kind: template.kind,
    label: template.label,
    cards: [...template.cards],
    ...(template.failCards ? { failCards: [...template.failCards] } : {}),
    ...(template.text ? { text: template.text } : {}),
    ...(template.successText ? { successText: template.successText } : {}),
    ...(template.failureText ? { failureText: template.failureText } : {}),
    ...(template.skill
      ? { skill: template.skill === 'handSkill' ? handSkill : template.skill }
      : {}),
    ...(template.difficulty ? { difficulty: template.difficulty } : {}),
    ...(template.checkKind ? { checkKind: template.checkKind } : {}),
    ...(template.textByLiar ? { text: template.textByLiar[liar] } : {}),
  }));
  const recipes: CaseRecipe[] = [
    ...CASE_RECIPE_TEMPLATES.map((recipe) => ({
      ...recipe,
      pair: [...recipe.pair] as [string, string],
      cards: [...recipe.cards],
    })),
    {
      id: CASE_ALIBI_RECIPE.id,
      pair: [...CASE_ALIBI_RECIPE.pairs[liar]] as [string, string],
      cards: [variant.truePlace],
      text: variant.alibiText,
    },
  ];

  return {
    seed,
    liar,
    handSkill,
    cards,
    groups,
    slots,
    evidence,
    recipes,
  };
}

export function caseRoomContent(graph: CaseGraph, roomId: string): NarrativeResponse {
  if (!CASE_ROOM_IDS.includes(roomId as (typeof CASE_ROOM_IDS)[number]) && roomId !== '100-1') {
    throw new Error(`Not a case room: ${roomId}`);
  }
  if (roomId === '100-1') {
    return {
      text: '第 100 层停在二十点整。案卷已经补上了可以补上的部分。',
      items: [],
      mood: '静滞',
      available_interactions: [{ ...FINALE_INTERACTION }],
    };
  }
  const interactions = graph.evidence
    .filter((evidence) => evidence.roomId === roomId)
    .map((evidence) => ({
      id: evidence.id,
      label: evidence.label,
      type: evidence.kind === 'look' ? ('action' as const) : ('check' as const),
      response: evidence.text || evidence.successText || '',
      ...(evidence.skill ? { skill: evidence.skill } : {}),
      ...(evidence.difficulty ? { difficulty: evidence.difficulty } : {}),
      ...(evidence.checkKind ? { kind: evidence.checkKind } : {}),
      ...(evidence.successText ? { success_response: evidence.successText } : {}),
      ...(evidence.failureText ? { failure_response: evidence.failureText } : {}),
    }));
  return {
    text: CASE_ROOM_DESCRIPTIONS[roomId],
    items: [],
    mood: '静滞',
    available_interactions: interactions,
  };
}

export function caseBible(graph: CaseGraph): StoryBible {
  const knownCharacters = new Map(FALLBACK_BIBLE.key_characters.map((character) => [character.name, character]));
  const roles: Record<string, string> = {
    'p-bartlebooth': '拼图的委托人',
    'p-winckler': '拼图工匠',
    'p-morellet': '住户',
    'p-nochere': '门房',
    'p-smautf': '男仆',
    'p-valene': '画家',
  };
  const cards = new Map(graph.cards.map((card) => [card.id, card]));

  return {
    title: '第 439 幅',
    themes: [...FALLBACK_BIBLE.themes],
    key_characters: Object.keys(CASE_CHARACTER_ROOMS).map((id) => {
      const card = cards.get(id)!;
      const known = knownCharacters.get(card.label);
      return {
        name: card.label,
        role: known?.role || roles[id],
        secret: known?.secret || '',
        home_room: CASE_CHARACTER_ROOMS[id],
      };
    }),
    plot_threads: FALLBACK_BIBLE.plot_threads.map((thread) => ({
      ...thread,
      stages: [...thread.stages],
    })),
    mystery: '二十点整，巴特尔布思死在第 439 幅拼图前。谁在说谎？',
    investigator_hook:
      '一封没有署名的信：二十点整，巴特尔布思死在第 439 幅拼图前。午夜以前，把案卷补完。',
    thoughts: FALLBACK_BIBLE.thoughts?.map((thought) => ({ ...thought })),
  };
}

export function solveCase(
  graph: CaseGraph,
  opts: { allowChecks?: boolean } = {}
): { solvable: boolean; missing: string[] } {
  const owned = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const evidence of graph.evidence) {
      if (opts.allowChecks === false && evidence.kind === 'check') continue;
      const grants = evidence.cards;
      grants.forEach((cardId) => {
        if (!owned.has(cardId)) {
          owned.add(cardId);
          changed = true;
        }
      });
    }
    for (const recipe of graph.recipes) {
      if (recipe.pair.every((cardId) => owned.has(cardId))) {
        recipe.cards.forEach((cardId) => {
          if (!owned.has(cardId)) {
            owned.add(cardId);
            changed = true;
          }
        });
      }
    }
  }
  const missing = graph.slots
    .map((slot) => slot.answer)
    .filter((answer) => !owned.has(answer));
  return { solvable: missing.length === 0, missing };
}
