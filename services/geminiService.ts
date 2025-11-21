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
    },
    available_interactions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          response: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["dialogue", "action"] }
        },
        required: ["label", "response", "type"]
      }
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
      mood: "Static",
      available_interactions: []
    };
  }

  let bibleContext = "";
  if (storyBible) {
    bibleContext = `
      STORY BIBLE (Hidden Background):
      - Mystery: ${storyBible.mystery}
      - Characters: ${storyBible.key_characters.map(c => `${c.name} (${c.role})`).join(", ")}
      - Plots: ${storyBible.plot_threads.join("; ")}
    `;
  }

  const knightBonus = isKnightMove
    ? "KNIGHT'S MOVE: The user arrived via a Knight's Move. This grants a moment of HYPER-LUCIDITY. Reveal a subtle but crucial detail about the building's history or structure."
    : "";

  const inventoryContext = inventory && inventory.length > 0
    ? `User Inventory: ${inventory.join(", ")}. IF an item here is relevant to an object in the room (e.g. they have a Key and there is a Locked Box), you MUST generate a specific interaction in 'available_interactions' to use it.`
    : "";

  const prompt = `
    Describe the room "${roomName}" (ID: ${roomId}) in the style of Georges Perec (La Vie mode d'emploi).
    Language: Simplified Chinese (简体中文).

    ${bibleContext}
    ${knightBonus}
    ${inventoryContext}

    PREVIOUS CONTEXT:
    ${context ? context : "None."}

    ### CRITICAL INSTRUCTIONS:
    1. **Show, Don't Tell**: Describe physical objects, spatial relations, textures, and light. DO NOT use abstract nouns like "emptiness", "solitude", or "absence" to describe objects. DO NOT explain what objects symbolize. Describe the thing itself.
    2. **Relevance Balance**: randomly decide the "Tension" of this room.
       - **Low Tension (60%)**: A purely atmospheric, infra-ordinary room. Mundane details of daily life. No mystery.
       - **High Tension (40%)**: A room that contains a subtle clue or connection to the Story Bible (a character, a letter, a missing object).
    3. **Interactions**: Generate 1-3 'available_interactions'. These are immediate actions.
       - Examples: "Read the note on the table", "Open the wardrobe", "Ask the resident about the noise".
       - For each, provide the 'response' text (what happens/what is said).
       - If the room has a character, include a 'dialogue' interaction.
    4. **Collectibles**: Occasionally (30%) include a 'collectible_item'.
       - If High Tension, make it a 'puzzle_piece'.
       - If Low Tension, make it a 'regular' item.

    ### OUTPUT FORMAT (JSON):
    - text: The room description (approx 150 words).
    - items: List of 3-5 visible objects.
    - mood: 1-2 words.
    - puzzle_hint: Optional subtle hint.
    - collectible_item: Optional.
    - available_interactions: Array of { label, response, type }.
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
      text: "The details are lost in the static...",
      items: ["Shadows"],
      mood: "Uncertain",
      available_interactions: []
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
