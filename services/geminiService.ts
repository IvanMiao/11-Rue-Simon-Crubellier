import { GoogleGenAI, Type } from "@google/genai";
import { Character, NarrativeResponse, StoryBible, StoryPlotThread } from "../types";
import { BUILDING_LAYOUT } from "../constants";
import { SKILL_META, SKILL_ORDER } from "../constants/skills";
import { fallbackBibleForSeed, fallbackRoom, FALLBACK_BIBLE } from "../utils/fallbackContent";
import { clockLabel, highestSkills } from "../utils/gameLogic";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const isLanguageModelEnabled = Boolean(apiKey);

const skillEnum = SKILL_ORDER;

const narrativeSchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING },
    items: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    mood: { type: Type.STRING },
    puzzle_hint: { type: Type.STRING },
    collectible_item: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        type: { type: Type.STRING, enum: ["regular", "puzzle_piece"] }
      },
      required: ["id", "name", "description"]
    },
    available_interactions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING },
          response: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["dialogue", "action", "check"] },
          skill: { type: Type.STRING, enum: skillEnum },
          difficulty: { type: Type.STRING, enum: ["trivial", "easy", "medium", "challenging", "formidable", "legendary"] },
          kind: { type: Type.STRING, enum: ["white", "red"] },
          success_response: { type: Type.STRING },
          failure_response: { type: Type.STRING },
          plot_flag: { type: Type.STRING },
          clue: { type: Type.STRING },
          morale_on_success: { type: Type.NUMBER },
          morale_on_fail: { type: Type.NUMBER },
          resolves_mystery: { type: Type.BOOLEAN }
        },
        required: ["label", "response", "type"]
      }
    },
    inner_voices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          skill: { type: Type.STRING, enum: skillEnum },
          text: { type: Type.STRING }
        },
        required: ["skill", "text"]
      }
    },
    npcs_present: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    plot_updates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          thread_id: { type: Type.STRING },
          clue: { type: Type.STRING }
        },
        required: ["thread_id", "clue"]
      }
    },
    offered_thought: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        skill: { type: Type.STRING, enum: skillEnum }
      },
      required: ["id", "title", "description", "skill"]
    }
  },
  required: ["text", "items", "mood"]
};

const storyBibleSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    themes: { type: Type.ARRAY, items: { type: Type.STRING } },
    key_characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          role: { type: Type.STRING },
          secret: { type: Type.STRING },
          home_room: { type: Type.STRING }
        },
        required: ["name", "role", "secret"]
      }
    },
    plot_threads: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          stages: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["id", "title", "summary"]
      }
    },
    mystery: { type: Type.STRING },
    investigator_hook: { type: Type.STRING },
    thoughts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          skill: { type: Type.STRING, enum: skillEnum }
        },
        required: ["id", "title", "description", "skill"]
      }
    }
  },
  required: ["title", "themes", "key_characters", "plot_threads", "mystery", "investigator_hook"]
};

function normalizeBible(raw: StoryBible): StoryBible {
  const plot_threads: StoryPlotThread[] = (raw.plot_threads || []).map((thread, i) => {
    const value = thread as StoryPlotThread | string;
    if (typeof value === 'string') {
      return { id: `thread-${i + 1}`, title: value.slice(0, 16), summary: value, stages: [] };
    }
    return {
      id: value.id || `thread-${i + 1}`,
      title: value.title,
      summary: value.summary,
      stages: value.stages || [],
    };
  });
  return {
    ...raw,
    plot_threads,
    investigator_hook: raw.investigator_hook || '你走进冻结的二十点。',
    thoughts: raw.thoughts || [],
  };
}

export const generateStoryBible = async (
  seed: number,
  character?: Character
): Promise<StoryBible> => {
  if (!apiKey) {
    return fallbackBibleForSeed(seed);
  }

  const buildingSummary = BUILDING_LAYOUT
    .filter(r => r.name && r.name.trim() !== '')
    .map(r => `Floor ${r.floor}: ${r.name} (${r.type})`)
    .join('\n');

  const skillLine = character
    ? SKILL_ORDER.map(id => `${SKILL_META[id].name} ${character.skills[id]}`).join(' / ')
    : '未知';

  const prompt = `
    Act as Georges Perec planning "La Vie mode d'emploi", crossed with a tabletop mystery runner.
    Create a UNIQUE "Story Bible" for one roguelike RUN of the building at 11 Rue Simon-Crubellier.

    RUN SEED: ${seed} (this number must change the mystery, the guilty pattern, and which residents matter)
    INVESTIGATOR: ${character?.name || '无名氏'} — ${character?.archetype || '游荡者'}
    SIGNATURE THOUGHT: ${character?.signatureThought || ''}
    SKILLS: ${skillLine}

    Building layout:
    ${buildingSummary}

    Requirements:
    1. Themes: 3 abstract recurring concepts.
    2. Key Characters: 4-6 residents from the layout whose lives intertwine THIS run. Include home_room matching a layout name.
    3. Plot Threads: 3 interlocking threads as objects {id, title, summary, stages}. IDs like thread-pipe, thread-letter. They must collide in at least one room.
    4. Mystery: one central secret that can be solved by exploring, not a metaphor with no answer.
    5. investigator_hook: why THIS investigator was allowed into the frozen 20:00. 2 sentences.
    6. thoughts: 3 interior "thought cabinet" ideas the investigator might internalize. Each buffs one skill.

    Language: Simplified Chinese (简体中文).
    Do NOT write a generic "entropy" mystery. Seed ${seed} must make it specific.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: storyBibleSchema,
      },
    });

    if (response.text) {
      return normalizeBible(JSON.parse(response.text) as StoryBible);
    }
    throw new Error("Empty response for Story Bible");
  } catch (error) {
    console.error("Story Bible generation error:", error);
    return fallbackBibleForSeed(seed);
  }
};

export interface RoomGenContext {
  historyContext?: string;
  storyBible?: StoryBible;
  inventory?: string[];
  isKnightMove?: boolean;
  moveKind?: 'walk' | 'knight' | 'elevator';
  character?: Character;
  knownClues?: string[];
  plotSummary?: string;
  minutesPastEight?: number;
  morale?: number;
  maxMorale?: number;
  seed?: number;
}

export const generateRoomDescription = async (
  roomId: string,
  roomName: string,
  ctx: RoomGenContext = {}
): Promise<NarrativeResponse> => {
  const seed = ctx.seed ?? 1;
  if (!apiKey) {
    return { ...fallbackRoom(roomId, roomName, seed, ctx.character, ctx.isKnightMove), source: 'authored' };
  }

  let bibleContext = "";
  if (ctx.storyBible) {
    bibleContext = `
      STORY BIBLE (do not dump secrets verbatim unless a check succeeds):
      - Hook: ${ctx.storyBible.investigator_hook}
      - Mystery (hidden): ${ctx.storyBible.mystery}
      - Characters: ${ctx.storyBible.key_characters.map(c => `${c.name} (${c.role}, ${c.home_room || '?'})`).join("; ")}
      - Threads: ${ctx.storyBible.plot_threads.map(t => `${t.id}:${t.title}`).join("; ")}
    `;
  }

  const moveLine =
    ctx.moveKind === 'knight' || ctx.isKnightMove
      ? "ARRIVAL: Knight's Move. HYPER-LUCIDITY. Reveal a structural rhyme with another room. Inner voice 'constraint' MUST speak."
      : ctx.moveKind === 'elevator'
        ? "ARRIVAL: Elevator. The shaft is a vertical sentence. Mention cables, floors flashing, a smell from another storey."
        : "ARRIVAL: Walking the corridor. Mundane, sequential, infra-ordinary.";

  const inventoryContext = ctx.inventory && ctx.inventory.length > 0
    ? `Inventory: ${ctx.inventory.join(", ")}. If an item unlocks something here, make a specific interaction to use it.`
    : "";

  const topSkills = ctx.character ? highestSkills(ctx.character, 3) : [];
  const skillBlock = ctx.character
    ? `PLAYER SKILLS (1-8): ${SKILL_ORDER.map(id => `${id}=${ctx.character!.skills[id]}`).join(', ')}
       Highest: ${topSkills.join(', ')}. Those inner voices should speak. Low skills stay silent or doubt.`
    : "";

  const prompt = `
    Describe the room "${roomName}" (ID: ${roomId}) in the style of Georges Perec crossed with Disco Elysium.
    Frozen moment: 23 June 1975, currently ${clockLabel(ctx.minutesPastEight || 0)} in the investigator's personal clock.
    Language: Simplified Chinese (简体中文).
    Run seed: ${seed}

    ${bibleContext}
    ${moveLine}
    ${inventoryContext}
    ${skillBlock}
    MORALE: ${ctx.morale ?? '?'}/${ctx.maxMorale ?? '?'}
    KNOWN CLUES: ${(ctx.knownClues || []).join(' | ') || 'None yet'}
    PLOT STATE: ${ctx.plotSummary || 'Threads unknown'}

    PREVIOUS ROOMS:
    ${ctx.historyContext ? ctx.historyContext : "None."}

    ### RULES
    1. Show, don't tell. Objects, spatial relations, textures, light. No abstract sermons.
    2. Tension: 50% infra-ordinary, 50% a clue that advances a plot thread. Knight arrival biases to clue.
    3. Inner voices: 1-3 entries in inner_voices from the player's HIGH skills. Short, first-person-plural skill speech, like Disco Elysium (e.g. a skill comments). Simplified Chinese.
    4. Interactions: 2-4 available_interactions. At least two MUST be skill checks:
       - set type="check", skill, difficulty, kind (white=retryable, red=once)
       - ALWAYS provide success_response and failure_response (different facts, not just tone)
       - On success, optionally set clue + plot_flag (thread id)
       - Failure may set morale_on_fail to -1
       - If this room can end the mystery AND known clues are many, one legendary check may set resolves_mystery true
    5. NPCs: if a key character's home_room matches, they may be present as a frozen tableau or a voice. Include a dialogue check.
    6. Collectible: ~25%. High tension -> puzzle_piece.
    7. Rarely offer offered_thought if the room cracks the investigator's worldview.

    ### OUTPUT
    text ~150-220 Chinese words. items 3-5. mood 1-2 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: narrativeSchema,
      },
    });

    if (response.text) {
      const data = JSON.parse(response.text) as NarrativeResponse;
      data.available_interactions = (data.available_interactions || []).map((it, i) => ({
        ...it,
        id: it.id || `${roomId}-act-${i}`,
      }));
      data.source = 'authored';
      return data;
    }
    throw new Error("Empty response");
  } catch (error) {
    console.error("Generation error:", error);
    return { ...fallbackRoom(roomId, roomName, seed, ctx.character, ctx.isKnightMove), source: 'authored' };
  }
};

export const inspectItem = async (item: string, roomContext: string): Promise<string> => {
  if (!apiKey) {
    return `你把「${item}」拿到光线里。边缘有使用过的温度，像一份刚从清单上被勾掉的证据。`;
  }

  const prompt = `
    The user inspects "${item}" in a room described as: "${roomContext}".
    Describe this item in extreme, microscopic detail (Perec style).
    Language: Simplified Chinese (简体中文).
    Keep it under 100 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || "Nothing remarkable.";
  } catch (error) {
    return "The details blur as you stare.";
  }
};

export { FALLBACK_BIBLE };
