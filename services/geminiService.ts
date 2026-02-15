import { GoogleGenAI, Type } from "@google/genai";
import { Milestone, MilestoneCategory, Difficulty } from '../types';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

export const generateCreativeMilestones = async (
  category: string | 'MIX', 
  difficulty: Difficulty | 'ALL',
  additionalInfo: string,
  count: number = 3
): Promise<Milestone[]> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("API Key is missing. Returning mock data.");
      return [];
    }

    const ai = new GoogleGenAI({ apiKey });

    // Explicit list of allowed categories for the prompt
    const allowedCategories = Object.values(MilestoneCategory).join(", ");

    let promptContext = "";
    if (category === 'MIX') {
      promptContext = `Erstelle ${count} komplett unterschiedliche, trendige Challenges aus den erlaubten Kategorien: [${allowedCategories}].`;
    } else {
      promptContext = `Erstelle ${count} verrückte Challenges exakt für die Kategorie "${category}".`;
    }

    if (difficulty !== 'ALL') {
      promptContext += ` Der Schwierigkeitsgrad muss zwingend "${difficulty}" sein.`;
    }

    if (additionalInfo) {
      promptContext += ` Zusatz-Info vom User (bitte berücksichtigen): "${additionalInfo}".`;
    }

    const prompt = `
      ${promptContext}
      WICHTIG: Verwende NUR die oben genannten Kategorien. Erfinde KEINE neuen Kategorienamen.
      Die Aufgaben müssen konkret und beweisbar sein.
      Gib für jede Challenge an, ob der beste Beweis ein FOTO oder ein VIDEO ist.
      Sprache: Deutsch.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Titel der Challenge" },
              description: { type: Type.STRING, description: "Was genau muss getan werden?" },
              category: { type: Type.STRING, description: `Kategorie aus Liste: ${allowedCategories}` },
              difficulty: { type: Type.STRING, enum: ["EASY", "MEDIUM", "HARD", "INSANE"] },
              proofType: { type: Type.STRING, enum: ["PHOTO", "VIDEO"], description: "Bester Beweistyp" }
            },
            required: ["title", "description", "category", "difficulty", "proofType"]
          }
        }
      }
    });

    const generatedRaw = response.text ? JSON.parse(response.text) : [];

    // Map to application Milestone type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newMilestones: Milestone[] = generatedRaw.map((item: any) => ({
      id: generateId(),
      title: item.title,
      description: item.description,
      category: item.category || (category === 'MIX' ? MilestoneCategory.FUN : category),
      difficulty: item.difficulty || Difficulty.MEDIUM,
      proofType: item.proofType || 'PHOTO',
      completed: false,
      isAiGenerated: true
    }));

    return newMilestones;

  } catch (error) {
    console.error("Error generating milestones:", error);
    return [];
  }
};

export const verifyMilestoneProof = async (
  title: string,
  description: string,
  base64Image: string
): Promise<{ verified: boolean; feedback: string }> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return { verified: true, feedback: "Demo-Modus: Sieht gut aus!" };
    }

    const ai = new GoogleGenAI({ apiKey });
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `
      Du bist Referee für eine Challenge.
      Challenge: "${title}"
      Beschreibung: "${description}"
      
      Ist das Bild ein gültiger Beweis? Sei humorvoll aber gerecht.
      
      Antworte JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verified: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING }
          },
          required: ["verified", "feedback"]
        }
      }
    });

    if (response.text) return JSON.parse(response.text);
    return { verified: false, feedback: "Konnte Bild nicht analysieren." };
  } catch (error) {
    return { verified: false, feedback: "Fehler bei der Überprüfung." };
  }
};