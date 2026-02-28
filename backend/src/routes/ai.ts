import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { GoogleGenAI, Type } from '@google/genai';
import rateLimit from 'express-rate-limit';

const router = Router();
const API_KEY = process.env.GEMINI_API_KEY;

// Rate limiting for AI endpoints (more restrictive)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Zu viele AI-Anfragen. Bitte warte kurz.' }
});

const generateId = () => Math.random().toString(36).substr(2, 9);

// POST /ai/generate
router.post('/generate', aiLimiter, [
  body('category').isString().notEmpty(),
  body('difficulty').isString().notEmpty(),
  body('additionalInfo').optional().isString(),
  body('count').optional().isInt({ min: 1, max: 20 })
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return;
  }

  try {
    const { category, difficulty, additionalInfo, count = 10 } = req.body;

    if (!API_KEY) {
      res.status(503).json({ error: 'AI-Service nicht verfügbar.' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const allowedCategories = ["TRAVEL", "SKILLS", "CAREER", "WELLNESS", "ADVENTURE", "RELATIONSHIPS", "CREATIVITY", "FINANCE", "FUN"];

    let promptContext = "";
    if (category === 'MIX') {
      promptContext = `Erstelle ${count} komplett unterschiedliche, trendige Challenges aus den erlaubten Kategorien: [${allowedCategories.join(", ")}].`;
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
              category: { type: Type.STRING, description: `Kategorie aus Liste: ${allowedCategories.join(", ")}` },
              difficulty: { type: Type.STRING, enum: ["EASY", "MEDIUM", "HARD", "INSANE"] },
              proofType: { type: Type.STRING, enum: ["PHOTO", "VIDEO"], description: "Bester Beweistyp" }
            },
            required: ["title", "description", "category", "difficulty", "proofType"]
          }
        }
      }
    });

    const generatedRaw = response.text ? JSON.parse(response.text) : [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const milestones = generatedRaw.map((item: any) => ({
      id: generateId(),
      title: item.title,
      description: item.description,
      category: item.category || (category === 'MIX' ? 'FUN' : category),
      difficulty: item.difficulty || 'MEDIUM',
      proofType: item.proofType || 'PHOTO',
      completed: false,
      isAiGenerated: true
    }));

    res.json(milestones);

  } catch (error) {
    console.error("Error generating milestones:", error);
    res.status(500).json({ error: 'Fehler beim Generieren von Challenges.' });
  }
});

// POST /ai/verify
router.post('/verify', aiLimiter, [
  body('title').isString().notEmpty(),
  body('description').isString().notEmpty(),
  body('base64Image').isString().notEmpty()
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return;
  }

  try {
    const { title, description, base64Image } = req.body;

    if (!API_KEY) {
      res.json({ verified: true, feedback: "Demo-Modus: Sieht gut aus!" });
      return;
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });
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

    if (response.text) {
      res.json(JSON.parse(response.text));
    } else {
      res.json({ verified: false, feedback: "Konnte Bild nicht analysieren." });
    }

  } catch (error) {
    console.error("Error verifying proof:", error);
    res.json({ verified: false, feedback: "Fehler bei der Überprüfung." });
  }
});

export default router;
