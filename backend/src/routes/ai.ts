import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { GoogleGenAI, Type } from '@google/genai';
import Groq from 'groq-sdk';
import rateLimit from 'express-rate-limit';

const router = Router();
const API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

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

    if (!API_KEY && !GROQ_API_KEY) {
      res.status(503).json({ error: 'AI-Service nicht verfügbar.' });
      return;
    }

    const allowedCategories = ["FUNandCringe", "SPORT", "SOCIAL", "OUTDOOR", "PARTY", "SKILLSandCREATIVITY", "SCHOOL", "INDOOR", "DRINKING"];

    const categoryDescriptions: Record<string, string> = {
      FUNandCringe: "Allgemeiner Spaß & Chaos (z.B. alles was keiner Kategorie passt, aber für Lacher sorgt)",
      SPORT: "Körperliche Challenges (z.B. Wettbewerbe, verrückte Moves, Ausdauer-Duelle)",
      SOCIAL: "Soziale Mutproben (z.B. Fremde ansprechen, peinliche Dinge in der Öffentlichkeit tun)",
      OUTDOOR: "Draußen-Spaß (z.B. Schnitzeljagd, Wasser, Schlamm, Park-Unsinn)",
      PARTY: "Party & Spiele (z.B. Trinkspiele-Varianten, Gesellschaftsspiel-Challenges, Karaoke-Mutas)",
      SKILLSandCREATIVITY: "Messe dich in verschiedenen Fähigkeiten, in welchen kaum jmd große Vorerfahrung hat, oder werde eif kreattiv (z.B. jonglieren, absurde Kunstwerke, Parodien, Kartenhaus bauen, ...)",
      SCHOOL: "Challenges im Klassenzimmer oder Studium (z.B. Lehrer imitieren, peinliche Fragen stellen, verrückte Präsentationen)",
      INDOOR: "Alles was man machen kann, ohne das Haus zu verlassen (orientere dich an anderen Kategorien, aber zwingend indoor umsetzbar)",
      DRINKING: "Die Challenge muss ein drinkspiel sein kann. Gebe immer an, nach welcher Handlung jmd einen Trinken muss"
    };

    let promptContext = "";
    if (category === 'MIX') {
      promptContext = `Erstelle ${count} komplett unterschiedliche, lustige Challenges die Freunde gegeneinander antreten lassen. Nutze verschiedene Kategorien aus: [${allowedCategories.join(", ")}].`;
    } else {
      const desc = categoryDescriptions[category] ?? category;
      promptContext = `Erstelle ${count} lustige Challenges für Freunde exakt zur Kategorie "${category}" (${desc}).`;
    }

    if (difficulty !== 'ALL') {
      promptContext += ` Schwierigkeitsgrad muss zwingend "${difficulty}" sein.`;
    }

    if (additionalInfo) {
      promptContext += ` Zusatz-Info vom User: "${additionalInfo}".`;
    }

    const prompt = `
      Du bist ein frecher Challenge-Generator für Freundesgruppen. Dein Ziel: maximaler Spaß, Lachen und Chaos.
      ${promptContext}

      REGELN:
      - Challenges müssen witzig, verrückt und mit Freunden sofort machbar sein
      - KEIN Sport im Sinne von Training, KEINE Karriere-Ziele, KEINE Finanztipps, KEINE Bildungsaufgaben
      - Challenges sollen peinlich, mutig, spaßig oder eklig (aber harmlos) sein
      - Jede Challenge muss konkret und innerhalb weniger Minuten beweisbar sein
      - Verwende NUR die erlaubten Kategorien: [${allowedCategories.join(", ")}]
      - Sprache: Deutsch, locker und jugendlich
    `;

    let generatedRaw: unknown[];

    if (GROQ_API_KEY) {
      const groq = new Groq({ apiKey: GROQ_API_KEY });
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 1,
        max_completion_tokens: 8192,
        top_p: 1,
//        reasoning_effort: "medium",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Du bist ein frecher Challenge-Generator für Freundesgruppen. Antworte IMMER als JSON-Objekt mit einem "challenges"-Array. Jede Challenge hat: title (string), description (string), category (einer aus: ${allowedCategories.join(", ")}), difficulty (EASY|MEDIUM|HARD|INSANE).`
          },
          { role: "user", content: prompt }
        ]
      });
      const text = completion.choices[0]?.message?.content ?? '{"challenges":[]}';
      const parsed = JSON.parse(text);
      generatedRaw = Array.isArray(parsed) ? parsed : (parsed.challenges ?? []);
    } else {
      const ai = new GoogleGenAI({ apiKey: API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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
                difficulty: { type: Type.STRING, enum: ["EASY", "MEDIUM", "HARD", "INSANE"] }
              },
              required: ["title", "description", "category", "difficulty"]
            }
          }
        }
      });
      generatedRaw = response.text ? JSON.parse(response.text) : [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const challenges = generatedRaw.map((item: any) => ({
      id: generateId(),
      title: item.title,
      description: item.description,
      category: item.category || (category === 'MIX' ? 'FUN' : category),
      difficulty: item.difficulty || 'MEDIUM',
      completed: false,
      isAiGenerated: true
    }));

    res.json(challenges);

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
      model: "gemini-2.0-flash-lite",
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
