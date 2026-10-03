import type { CheckDifficulty, CheckKind, SkillId } from '../types';
import type { CardKind, LiarId } from './types';

export const CASE_ROOM_IDS = [
  '0-5',
  '3-1',
  '6-3',
  '0-4',
  '8-2',
  '7-7',
  '8-6',
  '-1-3',
  '0-3',
  '6-1',
] as const;

export const CASE_LIAR_IDS: LiarId[] = ['p-nochere', 'p-smautf', 'p-valene'];

export const CASE_CARDS: Array<{ id: string; kind: CardKind; label: string }> = [
  { id: 'p-bartlebooth', kind: 'person', label: '巴特尔布思' },
  { id: 'p-winckler', kind: 'person', label: '温克勒' },
  { id: 'p-morellet', kind: 'person', label: '莫雷莱' },
  { id: 'p-nochere', kind: 'person', label: '诺谢尔太太' },
  { id: 'p-smautf', kind: 'person', label: '斯莫特' },
  { id: 'p-valene', kind: 'person', label: '瓦莱纳' },
  { id: 'shape-x', kind: 'shape', label: 'X 形' },
  { id: 'shape-w', kind: 'shape', label: 'W 形' },
  { id: 'shape-v', kind: 'shape', label: 'V 形' },
  { id: 'pl-loge', kind: 'place', label: '门房' },
  { id: 'pl-attic', kind: 'place', label: '仆人房' },
  { id: 'pl-studio', kind: 'place', label: '画室' },
  { id: 'pl-cellar', kind: 'place', label: '锅炉房' },
  { id: 'pl-antiques', kind: 'place', label: '古董店' },
  { id: 'pl-bartlebooth', kind: 'place', label: '巴特尔布思的工作室' },
  { id: 'o-death-notice', kind: 'object', label: '讣告' },
  { id: 'o-cut-notes', kind: 'object', label: '切割笔记' },
  { id: 'o-ledger-439', kind: 'object', label: '账簿第 439 行' },
  { id: 'o-blank-sheet', kind: 'object', label: '洗白的水彩纸' },
  { id: 'o-coal-glove', kind: 'object', label: '沾煤灰的手套' },
  { id: 'o-receipt', kind: 'object', label: '古董店收据' },
  { id: 'o-wet-brush', kind: 'object', label: '未干的画笔' },
  { id: 'ts-nochere', kind: 'testimony', label: '诺谢尔太太的证词' },
  { id: 'ts-smautf', kind: 'testimony', label: '斯莫特的证词' },
  { id: 'ts-valene', kind: 'testimony', label: '瓦莱纳的证词' },
  { id: 't-1973', kind: 'time', label: '1973 年' },
  { id: 't-1975', kind: 'time', label: '1975 年 6 月' },
  { id: 't-1950', kind: 'time', label: '1950 年' },
  { id: 'w-revenge', kind: 'word', label: '报复二十年的徒劳' },
  { id: 'w-gift', kind: 'word', label: '一份礼物' },
  { id: 'w-mistake', kind: 'word', label: '一次失手' },
];

export const CASE_SLOT_TEMPLATES = [
  { id: 'A1', groupId: 'A' as const, prompt: '桌上空洞的形状像字母 ___', accepts: ['shape'] as CardKind[], answer: 'shape-x' },
  { id: 'A2', groupId: 'A' as const, prompt: '他手里那一块的形状像字母 ___', accepts: ['shape'] as CardKind[], answer: 'shape-w' },
  { id: 'A3', groupId: 'A' as const, prompt: '切出这一块的人是 ___', accepts: ['person'] as CardKind[], answer: 'p-winckler' },
  { id: 'B1', groupId: 'B' as const, prompt: '说了谎的人是 ___', accepts: ['person'] as CardKind[], answer: 'liar' },
  { id: 'B2', groupId: 'B' as const, prompt: '二十点整，那个人其实在 ___', accepts: ['place'] as CardKind[], answer: 'true-place' },
  { id: 'B3', groupId: 'B' as const, prompt: '证明这一点的物件是 ___', accepts: ['object'] as CardKind[], answer: 'proof-object' },
  { id: 'C1', groupId: 'C' as const, prompt: '切割的人死于 ___', accepts: ['time'] as CardKind[], answer: 't-1973' },
  { id: 'C2', groupId: 'C' as const, prompt: '他留下这一块，是为了 ___', accepts: ['word'] as CardKind[], answer: 'w-revenge' },
  { id: 'C3', groupId: 'C' as const, prompt: '这件事最早写在 ___', accepts: ['object'] as CardKind[], answer: 'o-ledger-439' },
];

export const CASE_GROUP_TEMPLATES = [
  { id: 'A' as const, title: 'A 缺块', slotIds: ['A1', 'A2', 'A3'] },
  { id: 'B' as const, title: 'B 证词', slotIds: ['B1', 'B2', 'B3'] },
  { id: 'C' as const, title: 'C 动机', slotIds: ['C1', 'C2', 'C3'] },
];

export const CASE_LIAR_VARIANTS: Record<
  LiarId,
  {
    truePlace: string;
    proofObject: string;
    proofRoom: string;
    sillText: string;
    coalText: string;
    receiptText: string;
    alibiText: string;
  }
> = {
  'p-nochere': {
    truePlace: 'pl-cellar',
    proofObject: 'o-coal-glove',
    proofRoom: '-1-3',
    sillText: '笔毛硬得像草，至少干了一周。',
    coalText: '手套还是温的，内侧缝着门房的号码。',
    receiptText: '收据是上周的，签名是马基索夫人。',
    alibiText: '她说在门房，手套却还带着锅炉房的余温。',
  },
  'p-smautf': {
    truePlace: 'pl-antiques',
    proofObject: 'o-receipt',
    proofRoom: '0-3',
    sillText: '笔毛硬得像草，至少干了一周。',
    coalText: '手套冷透了，挂在这里不止一个冬天。',
    receiptText: '收据开于 20:00 整，签名：斯莫特。',
    alibiText: '他说在擦银器，收据却在 20:00 写下他的名字。',
  },
  'p-valene': {
    truePlace: 'pl-bartlebooth',
    proofObject: 'o-wet-brush',
    proofRoom: '3-1',
    sillText: '笔尖还是湿的，钴蓝和今晚的天空同一个颜色。',
    coalText: '手套冷透了，挂在这里不止一个冬天。',
    receiptText: '收据是上周的，签名是马基索夫人。',
    alibiText: '他说没离开画布，可他的笔在巴特尔布思的窗台上还没干。',
  },
};

export interface CaseEvidenceTemplate {
  id: string;
  roomId: string;
  kind: 'look' | 'check';
  label: string;
  cards: string[];
  failCards?: string[];
  text?: string;
  successText?: string;
  failureText?: string;
  skill?: SkillId | 'handSkill';
  difficulty?: CheckDifficulty;
  checkKind?: CheckKind;
  textByLiar?: Partial<Record<LiarId, string>>;
}

export const CASE_EVIDENCE_TEMPLATES: CaseEvidenceTemplate[] = [
  {
    id: 'ev-hall-mailboxes',
    roomId: '0-5',
    kind: 'look',
    label: '读信箱上的名字',
    cards: ['p-bartlebooth', 'p-winckler', 'p-morellet', 'p-nochere', 'p-smautf', 'p-valene'],
    text: '铜牌一排排亮着。巴特尔布思、温克勒、莫雷莱、诺谢尔太太、斯莫特、瓦莱纳。温克勒的那格信箱塞满了两年的灰。',
  },
  {
    id: 'ev-bb-puzzle',
    roomId: '3-1',
    kind: 'look',
    label: '俯看桌上的拼图',
    cards: ['shape-x'],
    text: '第 439 幅港口只剩一个空洞。空洞的轮廓像一个 X。',
  },
  {
    id: 'ev-bb-hand',
    roomId: '3-1',
    kind: 'check',
    label: '掰开他攥紧的手指',
    cards: ['shape-w'],
    failCards: ['shape-v'],
    skill: 'handSkill',
    difficulty: 'challenging',
    checkKind: 'white',
    successText: '那一块的轮廓是 W。它永远放不进 X。',
    failureText: '指缝里露出一角，像一个 V。你不太确定。',
  },
  {
    id: 'ev-bb-sill',
    roomId: '3-1',
    kind: 'look',
    label: '看窗台上的画笔',
    cards: ['o-wet-brush'],
    textByLiar: {
      'p-valene': '笔尖还是湿的，钴蓝和今晚的天空同一个颜色。',
      'p-nochere': '笔毛硬得像草，至少干了一周。',
      'p-smautf': '笔毛硬得像草，至少干了一周。',
    },
  },
  {
    id: 'ev-wk-bench',
    roomId: '6-3',
    kind: 'look',
    label: '翻开工作台上的笔记',
    cards: ['o-cut-notes'],
    text: '五百幅拼图的切割记录，一行一幅，字迹越来越小。',
  },
  {
    id: 'ev-wk-chair',
    roomId: '6-3',
    kind: 'check',
    label: '对着空椅子问他为什么',
    cards: ['w-revenge'],
    failCards: ['w-mistake'],
    skill: 'inland',
    difficulty: 'challenging',
    checkKind: 'red',
    successText: '椅子说：二十年，他只要求一个错位。',
    failureText: '你只听见自己说：也许只是手抖了。',
  },
  {
    id: 'ev-loge-notice',
    roomId: '0-4',
    kind: 'look',
    label: '读讣告栏',
    cards: ['o-death-notice', 't-1973'],
    text: '加斯帕尔·温克勒，拼图工匠，卒于 1973 年。卡片边缘已经发黄。',
  },
  {
    id: 'ev-loge-ask',
    roomId: '0-4',
    kind: 'look',
    label: '问诺谢尔太太二十点在哪',
    cards: ['ts-nochere', 'pl-loge'],
    text: '“我一直在门房，听见楼上有人起身。”她的手藏在围裙下面。',
  },
  {
    id: 'ev-sm-ask',
    roomId: '8-2',
    kind: 'look',
    label: '问斯莫特二十点在哪',
    cards: ['ts-smautf', 'pl-attic', 'w-gift'],
    text: '“我在房里擦银器。主人说过，那块拼图是一份礼物。”',
  },
  {
    id: 'ev-va-ask',
    roomId: '7-7',
    kind: 'look',
    label: '问瓦莱纳二十点在哪',
    cards: ['ts-valene', 'pl-studio'],
    text: '“我在画室，没有离开过画布。”画布上整栋楼停在二十点，有一扇窗空着。',
  },
  {
    id: 'ev-va-canvas',
    roomId: '7-7',
    kind: 'check',
    label: '辨认画布角落的日期',
    cards: ['t-1950'],
    failCards: ['t-1975'],
    skill: 'encyclopedia',
    difficulty: 'medium',
    checkKind: 'white',
    successText: '角落写着 1950，巴特尔布思出发去画港口的那一年。',
    failureText: '你把它读成了今天的日期。',
  },
  {
    id: 'ev-mo-vat',
    roomId: '8-6',
    kind: 'look',
    label: '看药水槽里的纸',
    cards: ['o-blank-sheet'],
    text: '每一幅拼好的港口都在这里被拆胶、洗回白纸，再寄回它被画下的海边。',
  },
  {
    id: 'ev-ch-coal',
    roomId: '-1-3',
    kind: 'look',
    label: '翻煤堆旁的手套',
    cards: ['o-coal-glove'],
    textByLiar: {
      'p-nochere': '手套还是温的，内侧缝着门房的号码。',
      'p-smautf': '手套冷透了，挂在这里不止一个冬天。',
      'p-valene': '手套冷透了，挂在这里不止一个冬天。',
    },
  },
  {
    id: 'ev-an-receipt',
    roomId: '0-3',
    kind: 'look',
    label: '读柜台上的收据',
    cards: ['o-receipt'],
    textByLiar: {
      'p-smautf': '收据开于 20:00 整，签名：斯莫特。',
      'p-nochere': '收据是上周的，签名是马基索夫人。',
      'p-valene': '收据是上周的，签名是马基索夫人。',
    },
  },
  {
    id: 'ev-ci-dict',
    roomId: '6-1',
    kind: 'check',
    label: '翻他正在删去的词条',
    cards: ['t-1973'],
    failCards: ['t-1975'],
    skill: 'encyclopedia',
    difficulty: 'medium',
    checkKind: 'white',
    successText: '被删去的词条旁注着“温克勒，1973”。',
    failureText: '你只看清了今天的日期。',
  },
];

export const CASE_RECIPE_TEMPLATES = [
  {
    id: 'rc-ledger',
    pair: ['o-cut-notes', 'shape-x'] as [string, string],
    cards: ['o-ledger-439', 'shape-w'],
    text: '第 439 行写着：洞是 X，块是 W。日期是 1972 年，他死前一年。',
  },
  {
    id: 'rc-revenge',
    pair: ['o-ledger-439', 'o-blank-sheet'] as [string, string],
    cards: ['w-revenge'],
    text: '二十年的港口最后都会变回白纸。温克勒只想让其中一幅永远合不上。',
  },
];

export const CASE_ALIBI_RECIPE = {
  id: 'rc-alibi',
  pairs: {
    'p-nochere': ['ts-nochere', 'o-coal-glove'],
    'p-smautf': ['ts-smautf', 'o-receipt'],
    'p-valene': ['ts-valene', 'o-wet-brush'],
  } satisfies Record<LiarId, [string, string]>,
};

export const CASE_ROOM_DESCRIPTIONS: Record<string, string> = {
  '0-5': '信箱的铜牌在二十点整反着光。六个名字都在，只有灰尘还在缓慢地堆积。',
  '3-1': '港口的第 439 幅拼图停在最后一个空洞前。巴特尔布思的手没有松开，那支画笔还留在窗台上。',
  '6-3': '温克勒的工作台保持着最后一次切割的角度。椅子空着，纸上的行距越来越窄。',
  '0-4': '门房的讣告栏一动不动，纸边已经泛黄。楼上没有脚步，诺谢尔太太的围裙垂在原处。',
  '8-2': '银器停在擦到一半的时候，窗外的楼层也停在同一秒。斯莫特的手藏在桌布下面。',
  '7-7': '画布上的整栋楼都停在二十点整。瓦莱纳没有离开画架，只有一扇窗还没有画上去。',
  '8-6': '药水槽里的纸没有浮动，白色的边沿停在水面。莫雷莱留下的气味像胶水和海盐。',
  '-1-3': '煤堆旁的手套没有落下灰。锅炉已经冷了，管道里的蒸汽却仍像一句没有说完的话。',
  '0-3': '古董店的柜台停在结账之前，收据压着一层薄灰。墙上的钟指向二十点整。',
  '6-1': '词条停在被删掉的那一行，橡皮屑没有落地。日期还在纸角上，等着有人重新读它。',
};

export const CASE_CHARACTER_ROOMS: Record<string, string> = {
  'p-bartlebooth': 'BARTLEBOOTH',
  'p-winckler': 'WINCKLER',
  'p-morellet': 'MORELLET',
  'p-nochere': 'LOGE',
  'p-smautf': 'SMAUTF',
  'p-valene': 'VALÈNE',
};
