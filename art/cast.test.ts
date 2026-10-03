import { CASE_CARDS } from '../case/caseData';
import { CAST, CAST_ORDER, cardArt, castByCard } from './cast';
import { hasGlyph } from './draw/glyphs';
import { PALETTE, TONES } from './palette';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const castIds = Object.keys(CAST);
assert(CAST_ORDER.length === castIds.length, 'CAST_ORDER includes every cast member once');
assert(new Set(CAST_ORDER).size === castIds.length, 'CAST_ORDER has no duplicate members');
assert(castIds.every((id) => CAST_ORDER.includes(id as (typeof CAST_ORDER)[number])), 'CAST_ORDER covers all CAST keys');

for (const card of CASE_CARDS.filter((candidate) => candidate.kind === 'person')) {
  assert(castByCard(card.id), `${card.id} resolves to a cast member`);
}

for (const card of CASE_CARDS.filter((candidate) => candidate.id.startsWith('ts-'))) {
  assert(cardArt(card.id).kind === 'testimony', `${card.id} resolves to testimony art`);
}

const missingGlyphIds = new Set<string>();
for (const card of CASE_CARDS) {
  if (card.kind !== 'person' && !card.id.startsWith('ts-') && !hasGlyph(card.id)) {
    missingGlyphIds.add(card.id);
  }
}
for (const id of CAST_ORDER) {
  for (const glyphId of CAST[id].signature) {
    if (!hasGlyph(glyphId)) missingGlyphIds.add(glyphId);
  }
}

const paletteValues = new Set<string>([...Object.values(PALETTE), ...Object.values(TONES)]);
const invalidColors = CAST_ORDER.flatMap((id) => {
  const member = CAST[id];
  const fields: [string, string][] = [
    ['color', member.color],
    ['coat', member.coat],
    ['trousers', member.trousers],
    ['trim', member.trim],
    ['head.skin', member.head.skin],
    ['head.hairColor', member.head.hairColor],
  ];
  return fields
    .filter(([, value]) => !paletteValues.has(value))
    .map(([field, value]) => `${id}.${field}=${value}`);
});

const failures = [
  ...(missingGlyphIds.size ? [`missing glyph ids: ${[...missingGlyphIds].join(', ')}`] : []),
  ...(invalidColors.length ? [`colors outside PALETTE/TONES: ${invalidColors.join(', ')}`] : []),
];
assert(failures.length === 0, failures.join('\n'));
console.log('cast checks passed');
