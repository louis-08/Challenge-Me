import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';

const router = Router();
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = 'openai/gpt-6-luna';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Rate limiting for AI endpoints (more restrictive)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Zu viele AI-Anfragen. Bitte warte kurz.' }
});

const generateId = () => Math.random().toString(36).substr(2, 9);

const parseJsonContent = (raw: string) => {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned);
};

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

    if (!OPENROUTER_API_KEY) {
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

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        temperature: 1,
        max_tokens: 8192,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Du bist ein frecher Challenge-Generator für Freundesgruppen. Antworte IMMER als JSON-Objekt mit einem "challenges"-Array. Jede Challenge hat: title (string), description (string), category (einer aus: ${allowedCategories.join(", ")}), difficulty (EASY|MEDIUM|HARD|INSANE).`
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errText}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content ?? '{"challenges":[]}';
    const parsed = parseJsonContent(text);
    const generatedRaw: unknown[] = Array.isArray(parsed) ? parsed : (parsed.challenges ?? []);

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

    if (!OPENROUTER_API_KEY) {
      res.json({ verified: true, feedback: "Demo-Modus: Sieht gut aus!" });
      return;
    }

    const dataUrl = base64Image.startsWith('data:')
      ? base64Image
      : `data:image/jpeg;base64,${base64Image}`;

    const prompt = `
      Du bist Referee für eine Challenge.
      Challenge: "${title}"
      Beschreibung: "${description}"
      
      Ist das Bild ein gültiger Beweis? Sei humorvoll aber gerecht.
      
      Antworte als JSON-Objekt mit den Feldern "verified" (boolean) und "feedback" (string).
    `;

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errText}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content;

    if (text) {
      res.json(parseJsonContent(text));
    } else {
      res.json({ verified: false, feedback: "Konnte Bild nicht analysieren." });
    }

  } catch (error) {
    console.error("Error verifying proof:", error);
    res.json({ verified: false, feedback: "Fehler bei der Überprüfung." });
  }
});

export default router;
