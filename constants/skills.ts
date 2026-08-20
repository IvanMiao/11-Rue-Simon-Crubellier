import { ArchetypeDef, CheckDifficulty, SkillId } from '../types';

export const SKILL_ORDER: SkillId[] = [
  'perception',
  'logic',
  'encyclopedia',
  'empathy',
  'inland',
  'shivers',
  'rhetoric',
  'constraint',
];

export const SKILL_META: Record<
  SkillId,
  { name: string; nameEn: string; color: string; bg: string; voice: string; desc: string }
> = {
  perception: {
    name: '感知',
    nameEn: 'Perception',
    color: '#0e7490',
    bg: '#ecfeff',
    voice: '感知',
    desc: '看见被忽略的边角：灰尘的走向、抽屉的缝、没擦干净的指纹。',
  },
  logic: {
    name: '逻辑',
    nameEn: 'Logic',
    color: '#1d4ed8',
    bg: '#eff6ff',
    voice: '逻辑',
    desc: '把散落的时刻拼回因果。佩雷克式的清单在你脑子里自己排队。',
  },
  encyclopedia: {
    name: '百科',
    nameEn: 'Encyclopedia',
    color: '#0f766e',
    bg: '#f0fdfa',
    voice: '百科',
    desc: '1975 年的巴黎、拼图工艺、失踪的画家、过时的商标。',
  },
  empathy: {
    name: '共情',
    nameEn: 'Empathy',
    color: '#be185d',
    bg: '#fdf2f8',
    voice: '共情',
    desc: '听见住户没说出口的那半句。家具也有表情。',
  },
  inland: {
    name: '内境',
    nameEn: 'Inland Empire',
    color: '#6d28d9',
    bg: '#f5f3ff',
    voice: '内境',
    desc: '物件开口说话。你分不清那是记忆、幻觉，还是这栋楼自己的梦。',
  },
  shivers: {
    name: '战栗',
    nameEn: 'Shivers',
    color: '#334155',
    bg: '#f8fafc',
    voice: '战栗',
    desc: '整栋楼通过通风管、水管和墙纸的纹路，把消息送到你脊背上。',
  },
  rhetoric: {
    name: '修辞',
    nameEn: 'Rhetoric',
    color: '#c2410c',
    bg: '#fff7ed',
    voice: '修辞',
    desc: '谈话是另一种拼图。正确的句子能让人交出秘密。',
  },
  constraint: {
    name: '约束',
    nameEn: 'Constraint',
    color: '#a16207',
    bg: '#fefce8',
    voice: '约束',
    desc: '骑士跳、字母限制、隐藏的网格。世界是一道被出过的题。',
  },
};

export const DIFFICULTY_DC: Record<CheckDifficulty, number> = {
  trivial: 6,
  easy: 8,
  medium: 10,
  challenging: 13,
  formidable: 15,
  legendary: 18,
};

export const DIFFICULTY_LABEL: Record<CheckDifficulty, string> = {
  trivial: '唾手可得',
  easy: '容易',
  medium: '普通',
  challenging: '困难',
  formidable: '严峻',
  legendary: '传奇',
};

export const SKILL_POINT_POOL = 8;
export const SKILL_MIN = 1;
export const SKILL_MAX_AT_CREATE = 5;
export const SKILL_MAX = 8;
export const BASE_MORALE = 4;
export const MINUTES_PER_RUN = 240;
export const TIME_WALK = 15;
export const TIME_KNIGHT = 8;
export const TIME_ELEVATOR = 20;
export const TIME_INTERACTION = 5;
export const TIME_INSPECT = 5;
export const TIME_THOUGHT = 20;
export const XP_PER_LEVEL = 7;
export const START_ROOM_ID = '0-5';
export const STORAGE_KEY = 'perec_run_state_v3';

export const ARCHETYPES: ArchetypeDef[] = [
  {
    id: 'cataloguer',
    name: '目录学家',
    title: '把世界写成清单的人',
    blurb: '你相信物件比人诚实。抽屉、商标、缺口和灰尘的层理会告诉你发生过什么。',
    signatureThought: '如果一切都能被列举，秘密就只是还没被写进目录的那一项。',
    bonuses: { perception: 3, logic: 2, encyclopedia: 2, constraint: 1 },
  },
  {
    id: 'medium',
    name: '通灵者',
    title: '替楼房做梦的人',
    blurb: '你不是来找证据的。你是来让这栋楼把压在舌头底下的话吐出来。',
    signatureThought: '墙壁比住户更记得谁哭过。',
    bonuses: { empathy: 3, inland: 2, shivers: 2, rhetoric: 1 },
  },
  {
    id: 'knight',
    name: '棋手',
    title: '只走骑士跳的人',
    blurb: '你把人生当成一盘被限制的棋。斜向的两步加一步，会抵达直线永远到不了的房间。',
    signatureThought: '正确的路径从来不是最短的那条。',
    bonuses: { constraint: 3, logic: 2, perception: 2, inland: 1 },
  },
];

export const DEFAULT_SKILLS = (): Record<SkillId, number> =>
  SKILL_ORDER.reduce((acc, id) => {
    acc[id] = SKILL_MIN;
    return acc;
  }, {} as Record<SkillId, number>);
