import { BUILDING_LAYOUT } from '../constants';
import { SKILL_ORDER } from '../constants/skills';
import {
  Character,
  CheckDifficulty,
  InnerVoice,
  Interaction,
  NarrativeResponse,
  SkillId,
  StoryBible,
} from '../types';
import { hashString, mulberry32, pickIndex } from './rng';

const FALLBACK_THREADS = [
  {
    id: 'thread-puzzle',
    title: '未完成的拼图',
    summary: '巴特尔布思的拼图缺了一块。缺的不是纸板，是一个拒绝被拼上的夜晚。',
    stages: ['传闻', '物证', '对质', '合上'],
  },
  {
    id: 'thread-pipe',
    title: '水管里的字母',
    summary: '六层到地窖的水管在夜里敲出摩尔斯。有人用蒸汽写信。',
    stages: ['异响', '破译', '源头'],
  },
  {
    id: 'thread-portrait',
    title: '被涂改的肖像',
    summary: '瓦莱纳画了整栋楼，却把其中一张脸涂成了窗。',
    stages: ['画布', '缺席者', '签名'],
  },
];

export const FALLBACK_BIBLE: StoryBible = {
  title: '二十点整的清单',
  themes: ['列举即记忆', '约束之下的自由', '消失的那一块'],
  key_characters: [
    {
      name: '巴特尔布思',
      role: '拼图的委托人',
      secret: '他让温克勒做的拼图里，有一块永远对不上，那是他给自己准备的退路。',
      home_room: 'BARTLEBOOTH',
    },
    {
      name: '温克勒',
      role: '拼图工匠',
      secret: '他在某一块拼图背面写了整栋楼的真实出生日期。',
      home_room: 'WINCKLER',
    },
    {
      name: '瓦莱纳',
      role: '画家',
      secret: '他的画不是速写，是一张未来的死亡名录。',
      home_room: 'VALÈNE',
    },
    {
      name: '斯莫特',
      role: '男仆',
      secret: '他替主人保存着一封没有寄出的信，收件人是这栋楼本身。',
      home_room: 'SMAUTF',
    },
  ],
  plot_threads: FALLBACK_THREADS,
  mystery: '1975年6月23日20:00，有一块拼图、一封信和一口蒸汽，同时停在半空。谁让时间冻结？',
  investigator_hook: '你受一封没有署名的信委托：在午夜以前，找到“缺的那一块”。信纸的水印是骑士跳的轨迹。',
  thoughts: [
    {
      id: 'thought-catalogue',
      title: '世界是一份未完成的清单',
      description: '每记下一样物件，就有另一样物件在别处消失。你开始怀疑列举本身在改写这栋楼。',
      skill: 'encyclopedia',
    },
    {
      id: 'thought-knight',
      title: 'L 形的自由',
      description: '直线是监视，斜线是逃逸。你感到自己的步法正在被一盘棋阅读。',
      skill: 'constraint',
    },
    {
      id: 'thought-steam',
      title: '蒸汽文法',
      description: '水管里的敲击不是故障。那是一种被限制了字母表的语言。',
      skill: 'inland',
    },
  ],
};

const OBJECT_POOL = [
  '一枚缺角的邮票',
  '半杯已经不冒热气的茶',
  '一份折了三次的报纸',
  '一串没有钥匙的钥匙圈',
  '一盒缺了三粒的纽扣',
  '一盘下到中盘的国际象棋',
  '一封未贴邮票的信',
  '一块背面写着铅笔字的拼图',
  '一副指纹未擦的眼镜',
  '一本被水泡过的电话簿',
  '一只停在 20:00 的旅行钟',
  '一条绣着楼牌号的手帕',
];

const MOODS = ['静滞', '尘埃', '精确', '微温', '绷紧', '陈列'];

function pickSkill(rng: () => number, character?: Character): SkillId {
  if (!character) return SKILL_ORDER[pickIndex(rng, SKILL_ORDER.length)];
  const weighted = SKILL_ORDER.flatMap((id) => Array(character.skills[id]).fill(id));
  return weighted[pickIndex(rng, weighted.length)] || 'perception';
}

function difficultyFromRng(rng: () => number): CheckDifficulty {
  const n = rng();
  if (n < 0.15) return 'easy';
  if (n < 0.45) return 'medium';
  if (n < 0.75) return 'challenging';
  if (n < 0.92) return 'formidable';
  return 'legendary';
}

export function fallbackRoom(
  roomId: string,
  roomName: string,
  seed: number,
  character?: Character,
  isKnightMove?: boolean
): NarrativeResponse {
  const rng = mulberry32(seed ^ hashString(roomId + (roomName || 'empty')));
  const displayName = roomName?.trim() || '未标名的房间';
  const items = Array.from({ length: 3 }, () => OBJECT_POOL[pickIndex(rng, OBJECT_POOL.length)]);
  const uniqueItems = Array.from(new Set(items));
  while (uniqueItems.length < 3) {
    uniqueItems.push(OBJECT_POOL[pickIndex(rng, OBJECT_POOL.length)]);
  }

  const skillA = pickSkill(rng, character);
  const skillB = pickSkill(rng, character);
  const thread = FALLBACK_THREADS[pickIndex(rng, FALLBACK_THREADS.length)];
  const highTension = rng() < 0.42 || isKnightMove;

  const interactions: Interaction[] = [
    {
      id: `${roomId}-look`,
      label: `翻看${uniqueItems[0]}`,
      type: 'check',
      skill: skillA,
      difficulty: difficultyFromRng(rng),
      kind: 'white',
      response: '你把手伸过去。',
      success_response: `在${uniqueItems[0]}下面，有一张被汗浸过的字条，字迹指向另一层的住户。`,
      failure_response: `你碰到了它，灰尘立起来，像拒绝被编目的微小暴动。什么也没有增加。`,
      plot_flag: thread.id,
      clue: highTension ? `${displayName}里出现了与「${thread.title}」有关的痕迹。` : undefined,
      morale_on_fail: -1,
    },
    {
      id: `${roomId}-speak`,
      label: roomName ? `询问空气中的${displayName}` : '对着空房间说话',
      type: 'dialogue',
      skill: skillB,
      difficulty: 'medium',
      kind: rng() < 0.35 ? 'red' : 'white',
      response: '你清了清喉咙。',
      success_response: '有人在隔壁用气音回答。不是拒绝，是把句子的后半截留给你自己补全。',
      failure_response: '回声把你的问题原样送回，只是少了主语。',
      morale_on_success: 1,
      morale_on_fail: -1,
    },
  ];

  if (roomId === '100-1') {
    interactions.push({
      id: `${roomId}-finale`,
      label: '把缺的那一块按进最后的空洞',
      type: 'check',
      skill: 'constraint',
      difficulty: 'formidable',
      kind: 'red',
      response: '你举起那一块。',
      success_response: '空洞接受了它。不是因为形状对了，是因为你允许缺口存在。整栋楼在二十点整轻轻点头。',
      failure_response: '它滑开了。午夜更近。你还可以再找一块别的缺。',
      plot_flag: 'thread-puzzle',
      clue: '第一百把钥匙不是物件，是承认缺口的那一秒钟。',
      resolves_mystery: true,
      morale_on_fail: -1,
    });
  } else if (highTension) {
    interactions.push({
      id: `${roomId}-secret`,
      label: '沿着骑士跳的影子看向墙角',
      type: 'check',
      skill: 'constraint',
      difficulty: isKnightMove ? 'easy' : 'challenging',
      kind: 'red',
      response: '你侧过身，让光线改道。',
      success_response: '墙纸的重复图案在这里断了一格。断口后面是一块拼图像素大小的空洞。',
      failure_response: '图案继续重复。你怀疑是自己想看见缺口。',
      plot_flag: 'thread-puzzle',
      clue: '墙纸的缺口与拼图的缺块是同一个尺寸。',
      resolves_mystery: false,
      morale_on_fail: -1,
    });
  }

  const voices: InnerVoice[] = (character
    ? SKILL_ORDER.filter((id) => character.skills[id] >= 3)
    : (['perception', 'inland'] as SkillId[])
  )
    .slice(0, 2)
    .map((skill) => ({
      skill,
      text:
        skill === 'constraint'
          ? '这间房在网格上的位置不是偶然。注意你是怎么进来的。'
          : skill === 'shivers'
            ? '整栋楼在你肩胛骨后面轻轻咳嗽了一声。'
            : skill === 'empathy'
              ? '有人刚刚离开。椅子还在保持那个人的坐姿。'
              : '把看见的东西写下来。没写下来的会先消失。',
    }));

  const text = isKnightMove
    ? `你以骑士的步法落入${displayName || '这个格子'}。光线像被重新排过版：桌沿、地毯磨损、窗玻璃上的指纹，突然全部对上了同一条辅助线。时间仍停在二十点整。${highTension ? '有什么东西刚被从清单上擦掉，橡皮屑还在。' : '普通得近乎挑衅。'}`
    : `${displayName || '房间'}停在六月二十三日二十点。空气有纸张和地板蜡的气味。你看见${uniqueItems[0]}、${uniqueItems[1]}，以及${uniqueItems[2]}。没有人走动。可是所有物件都像正在等待被点名。`;

  return {
    text,
    items: uniqueItems.slice(0, 4),
    mood: MOODS[pickIndex(rng, MOODS.length)],
    puzzle_hint: highTension ? '缺的那一块喜欢藏在重复的图案里。' : undefined,
    collectible_item:
      rng() < 0.3
        ? {
            id: `${roomId}-item-${Math.floor(rng() * 1000)}`,
            name: uniqueItems[0],
            description: `从${displayName}带走的物件。它比看上去更轻。`,
            type: highTension ? 'puzzle_piece' : 'regular',
          }
        : undefined,
    available_interactions: interactions,
    inner_voices: voices,
    npcs_present: highTension && roomName ? [roomName.split(' ')[0]] : [],
    plot_updates: highTension
      ? [{ thread_id: thread.id, clue: `在${displayName}察觉到「${thread.title}」的气息。` }]
      : [],
    offered_thought:
      rng() < 0.12
        ? {
            id: `thought-${roomId}`,
            title: '重复即逃逸',
            description: '如果每个房间都在列举自己，那么秘密就是那个拒绝被列举的例外。',
            skill: pickSkill(rng, character),
          }
        : undefined,
  };
}

export function fallbackBibleForSeed(seed: number): StoryBible {
  const rng = mulberry32(seed);
  const rooms = BUILDING_LAYOUT.filter((r) => r.name && r.name.trim());
  const pickRoom = () => rooms[pickIndex(rng, rooms.length)].name;
  const bible: StoryBible = JSON.parse(JSON.stringify(FALLBACK_BIBLE));
  bible.title = rng() < 0.5 ? '二十点整的清单' : '缺块之书';
  bible.key_characters = bible.key_characters.map((c) => ({
    ...c,
    home_room: c.home_room || pickRoom(),
  }));
  bible.investigator_hook = `种子 ${seed.toString(16).toUpperCase()}。一封没有署名的信把你送进西蒙-克吕贝里埃街 11 号：午夜前找到缺的那一块。`;
  return bible;
}
