// A2 cast bible: the closed set of residents. Every figure, bust, window silhouette and person
// card is drawn from these specs, so a resident looks the same in every run and every view.
// Pure data, no DOM or three.js: safe to import from the React app and from node tests.
import { PALETTE, TONES } from './palette';

export type CastId = 'bartlebooth' | 'winckler' | 'morellet' | 'nochere' | 'smautf' | 'valene' | 'marquiseau';

/** One frozen pose per resident: what they were doing at 20:00 when time stopped. */
export type Pose = 'reach' | 'seatedReach' | 'saw' | 'pour' | 'sweep' | 'valise' | 'paint' | 'tray';

export type Costume = 'frockcoat' | 'cardiganApron' | 'labcoat' | 'housecoatApron' | 'waistcoat' | 'smock' | 'dress';
export type HairStyle = 'swept' | 'thinning' | 'bald' | 'headscarf' | 'fringe' | 'bun';

/** Glyphs that are not case cards but belong to a resident's signature set. */
export type ExtraGlyphId =
  | 'i-magnifier'
  | 'i-paintbox'
  | 'i-fretsaw'
  | 'i-flask'
  | 'i-bandage'
  | 'i-keys'
  | 'i-broom'
  | 'i-valise'
  | 'i-sums'
  | 'i-palette'
  | 'i-elevation'
  | 'i-teacup'
  | 'i-letter'
  | 'i-mirror';

/** A glyph is either a case card id (e.g. 'o-receipt', 'shape-w') or an extra glyph id. */
export type GlyphId = string;

export interface CastMember {
  id: CastId;
  name: string;
  nameFr: string;
  /** Case person card, when the resident appears in the M2 case. */
  cardId?: string;
  /** Building room id (constants.ts BUILDING_LAYOUT). */
  roomId: string;
  /** Signature colour: coat, window glow and testimony-card tint. */
  color: string;
  /** One-line role for the cast sheet. */
  role: string;
  build: {
    /** Relative standing height, 1 = 1.72 m. */
    height: number;
    /** Relative shoulder/hip width, 1 = average. */
    width: number;
    /** 0 upright … 1 strongly stooped. */
    stoop: number;
  };
  head: {
    hair: HairStyle;
    hairColor: string;
    skin: string;
    glasses?: 'round' | 'dark';
    moustache?: boolean;
    beard?: boolean;
    hat?: 'beret';
  };
  costume: Costume;
  coat: string;
  trousers: string;
  /** Apron, collar, cuffs, scarf. */
  trim: string;
  pose: Pose;
  /** Three signature objects; they double as the resident's card glyphs. */
  signature: [GlyphId, GlyphId, GlyphId];
  /** Wall and floor tint of the resident's room in the section view. */
  wall: string;
  floor: string;
  /** Dead before 23 June 1975: shown in sepia, as a photograph. */
  deceased?: boolean;
}

export const CAST: Record<CastId, CastMember> = {
  bartlebooth: {
    id: 'bartlebooth',
    name: '巴特尔布思',
    nameFr: 'Percival Bartlebooth',
    cardId: 'p-bartlebooth',
    roomId: '3-1',
    color: TONES.navy,
    role: '富有的英国人，失明，第 439 幅拼图前的死者',
    build: { height: 1.08, width: 0.86, stoop: 0.15 },
    head: { hair: 'swept', hairColor: TONES.hairWhite, skin: TONES.skinPale, glasses: 'dark' },
    costume: 'frockcoat',
    coat: TONES.navy,
    trousers: TONES.charcoal,
    trim: PALETTE.linen,
    pose: 'seatedReach',
    signature: ['shape-w', 'i-magnifier', 'i-paintbox'],
    wall: PALETTE.wall,
    floor: PALETTE.floor,
  },
  winckler: {
    id: 'winckler',
    name: '温克勒',
    nameFr: 'Gaspard Winckler',
    cardId: 'p-winckler',
    roomId: '6-3',
    color: TONES.ochre,
    role: '拼图切割工匠，1973 年去世',
    build: { height: 0.96, width: 1.0, stoop: 0.45 },
    head: { hair: 'thinning', hairColor: TONES.hairGrey, skin: TONES.skinWarm, glasses: 'round' },
    costume: 'cardiganApron',
    coat: TONES.ochre,
    trousers: TONES.umber,
    trim: TONES.leather,
    pose: 'saw',
    signature: ['i-fretsaw', 'o-cut-notes', 'o-ledger-439'],
    wall: PALETTE.castWallSand,
    floor: PALETTE.castFloorOchre,
    deceased: true,
  },
  morellet: {
    id: 'morellet',
    name: '莫雷莱',
    nameFr: 'Morellet',
    cardId: 'p-morellet',
    roomId: '8-6',
    color: TONES.labWhite,
    role: '实验员，替巴特尔布思把水彩洗回白纸，左手少了三根手指',
    build: { height: 0.9, width: 0.84, stoop: 0.2 },
    head: { hair: 'bald', hairColor: TONES.hairBrown, skin: TONES.skinRuddy },
    costume: 'labcoat',
    coat: TONES.labWhite,
    trousers: TONES.charcoal,
    trim: TONES.bandage,
    pose: 'pour',
    signature: ['o-blank-sheet', 'i-flask', 'i-bandage'],
    wall: PALETTE.castWallMint,
    floor: PALETTE.castFloorTaupe,
  },
  nochere: {
    id: 'nochere',
    name: '诺谢尔太太',
    nameFr: 'Madame Nochère',
    cardId: 'p-nochere',
    roomId: '0-4',
    color: TONES.cobalt,
    role: '门房，什么都知道一点',
    build: { height: 0.86, width: 1.22, stoop: 0.1 },
    head: { hair: 'headscarf', hairColor: TONES.hairBrown, skin: TONES.skinWarm },
    costume: 'housecoatApron',
    coat: TONES.cobalt,
    trousers: TONES.slate,
    trim: TONES.apron,
    pose: 'sweep',
    signature: ['i-keys', 'o-coal-glove', 'i-broom'],
    wall: PALETTE.castWallStone,
    floor: PALETTE.castFloorRust,
  },
  smautf: {
    id: 'smautf',
    name: '斯莫特',
    nameFr: 'Mortimer Smautf',
    cardId: 'p-smautf',
    roomId: '8-2',
    color: TONES.bottle,
    role: '跟了巴特尔布思二十年的老仆，靠心算打发夜晚',
    build: { height: 1.0, width: 1.0, stoop: 0.25 },
    head: { hair: 'fringe', hairColor: TONES.hairWhite, skin: TONES.skinOlive, moustache: true },
    costume: 'waistcoat',
    coat: TONES.bottle,
    trousers: TONES.pine,
    trim: PALETTE.linen,
    pose: 'valise',
    signature: ['i-valise', 'i-sums', 'o-receipt'],
    wall: PALETTE.castWallSage,
    floor: PALETTE.castFloorChestnut,
  },
  valene: {
    id: 'valene',
    name: '瓦莱纳',
    nameFr: 'Serge Valène',
    cardId: 'p-valene',
    roomId: '7-7',
    color: TONES.aubergine,
    role: '老画家，想把整栋楼画进一幅画里',
    build: { height: 0.92, width: 0.8, stoop: 0.35 },
    head: { hair: 'fringe', hairColor: TONES.hairWhite, skin: TONES.skinPale, beard: true, hat: 'beret' },
    costume: 'smock',
    coat: TONES.aubergine,
    trousers: TONES.graphite,
    trim: PALETTE.linen,
    pose: 'paint',
    signature: ['o-wet-brush', 'i-palette', 'i-elevation'],
    wall: PALETTE.castWallCream,
    floor: PALETTE.castFloorHoney,
  },
  marquiseau: {
    id: 'marquiseau',
    name: '马基索夫人',
    nameFr: 'Madame Marquiseaux',
    roomId: '4-3',
    color: TONES.rose,
    role: '四楼的住户，与本案无关',
    build: { height: 0.94, width: 0.92, stoop: 0 },
    head: { hair: 'bun', hairColor: TONES.hairAuburn, skin: TONES.skinPale },
    costume: 'dress',
    coat: TONES.rose,
    trousers: TONES.plum,
    trim: PALETTE.linen,
    pose: 'tray',
    signature: ['i-teacup', 'i-letter', 'i-mirror'],
    wall: PALETTE.castWallRose,
    floor: PALETTE.castFloorMahogany,
  },
};

export const CAST_ORDER: CastId[] = ['bartlebooth', 'winckler', 'morellet', 'nochere', 'smautf', 'valene', 'marquiseau'];

export function castByCard(cardId: string): CastMember | undefined {
  return CAST_ORDER.map((id) => CAST[id]).find((m) => m.cardId === cardId);
}

/** How a case card is illustrated: person cards show the resident's bust, testimony cards a tinted speech balloon. */
export type CardArt =
  | { kind: 'bust'; cast: CastId }
  | { kind: 'testimony'; cast: CastId }
  | { kind: 'glyph'; glyph: GlyphId };

export function cardArt(cardId: string): CardArt {
  const person = castByCard(cardId);
  if (person) return { kind: 'bust', cast: person.id };
  if (cardId.startsWith('ts-')) {
    const speaker = castByCard('p-' + cardId.slice(3));
    if (speaker) return { kind: 'testimony', cast: speaker.id };
  }
  return { kind: 'glyph', glyph: cardId };
}
