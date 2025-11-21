import { GoogleGenAI, Type } from "@google/genai";
import { NarrativeResponse, StoryBible } from "../types";
import { BUILDING_LAYOUT } from "../constants";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const FALLBACK_BIBLE: StoryBible = {
  title: "Static Noise",
  themes: ["Entropy"],
  key_characters: [],
  plot_threads: ["The ink has faded."],
  mystery: "Unknown"
};

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
          secret: { type: Type.STRING }
        },
        required: ["name", "role", "secret"]
      }
    },
    plot_threads: { type: Type.ARRAY, items: { type: Type.STRING } },
    mystery: { type: Type.STRING }
  },
  required: ["title", "themes", "key_characters", "plot_threads", "mystery"]
};

export const generateStoryBible = async (): Promise<StoryBible> => {
  if (!apiKey) {
    return FALLBACK_BIBLE;
  }

  // Construct a summary of the building layout
  const buildingSummary = BUILDING_LAYOUT
    .filter(r => r.name && r.name.trim() !== '')
    .map(r => `Floor ${r.floor}: ${r.name} (${r.type})`)
    .join('\n');

  const prompt = `
    Act as Georges Perec planning "La Vie mode d'emploi".
    Create a "Story Bible" for the building at 11 Rue Simon-Crubellier.
    
    Here is the actual layout of the building and its residents:
    ${buildingSummary}
    
    This bible will serve as the hidden backbone for all subsequent room descriptions.
    It should contain:
    1. Themes: Abstract concepts that will recur.
    2. Key Characters: Select a few residents from the provided layout whose lives intertwine.
    3. Plot Threads: Events (past or present) that affect multiple rooms (e.g., a stolen painting, a leaked pipe, a forbidden love affair).
    4. Mystery: A central secret.

    Language: Simplified Chinese (简体中文).
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
      return JSON.parse(response.text) as StoryBible;
    }
    throw new Error("Empty response for Story Bible");
  } catch (error) {
    console.error("Story Bible generation error:", error);
    return FALLBACK_BIBLE;
  }
};

export const generateRoomDescription = async (
  roomId: string,
  roomName: string,
  context?: string,
  storyBible?: StoryBible,
  inventory?: string[], // List of item names currently held
  isKnightMove?: boolean
): Promise<NarrativeResponse> => {
  if (!apiKey) {
    return {
      text: "The room is silent. (API Key missing)",
      items: ["Dust"],
      mood: "Static"
    };
  }

  let bibleContext = "";
  if (storyBible) {
    bibleContext = `
      STORY BIBLE CONTEXT (Hidden from user, but must guide the narrative):
      - Title: ${storyBible.title}
      - Themes: ${storyBible.themes.join(", ")}
      - Mystery: ${storyBible.mystery}
      - Key Characters: ${storyBible.key_characters.map(c => `${c.name} (${c.role})`).join(", ")}
      - Plot Threads: ${storyBible.plot_threads.join("; ")}
      
      INSTRUCTION: Subtly weave in ONE reference to the bible (a character, a theme, or a clue to the mystery) if it fits naturally. Do not force it.
    `;
  }

  const knightBonus = isKnightMove
    ? "SPECIAL INSTRUCTION: The user arrived via a 'Knight's Move' (Chess). Provide a moment of PERFECT CLARITY. The description should be hyper-detailed, revealing a hidden connection or a small epiphany about the building's history."
    : "";

  const inventoryContext = inventory && inventory.length > 0
    ? `User is carrying: ${inventory.join(", ")}. You may allow them to use an item if it fits the context (e.g. use a key to open a box), but do not force it.`
    : "";

  const prompt = `
    Describe the room "${roomName}" (ID: ${roomId}) in the style of Georges Perec (La Vie mode d'emploi).
    
    ${bibleContext}
    ${knightBonus}
    ${inventoryContext}

    CONTEXT FROM PREVIOUSLY VISITED ROOMS:
    ${context ? context : "No other rooms visited yet."}

    Requirements:
    1. Detailed, observational, listing objects and spatial relations.
    2. "Infra-ordinary" style.
    3. Language: Simplified Chinese (简体中文).
    4. Include a list of 3-5 distinct items found in the room.
    5. Define the mood (1-2 words).
    6. Optional: A subtle puzzle hint related to the room's occupant or history.
    7. OFTEN (40% chance): Include a 'collectible_item' in the JSON response.
       - If the room is significant (e.g. occupied by a key character from the Bible), make it a 'puzzle_piece' (e.g. "A fragment of the blueprint", "A torn diary page", "A strange gear").
       - Otherwise, make it a 'regular' item (e.g. "A brass key", "A matchbox").
       - The item should invite interaction (e.g. "A locked box" rather than just "A box").
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
      return JSON.parse(response.text) as NarrativeResponse;
    }
    throw new Error("Empty response");
  } catch (error) {
    console.error("Generation error:", error);
    return {
      text: "The fog of memory obscures this room...",
      items: ["Shadows"],
      mood: "Uncertain"
    };
  }
};

export const inspectItem = async (item: string, roomContext: string): Promise<string> => {
  if (!apiKey) return "You look closer, but see nothing more.";

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