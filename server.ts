import 'dotenv/config';
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function callOpenRouter(messages: any[], model: string, systemInstruction?: string, jsonMode: boolean = false) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is required');
  }

  const payload: any = {
    model,
    messages: systemInstruction ? [{ role: "system", content: systemInstruction }, ...messages] : messages,
  };

  if (jsonMode) {
    payload.response_format = { type: "json_object" };
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "Modern School App"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenRouter error:", errText);
    throw new Error(`OpenRouter API Error: ${response.status}`);
  }

  return await response.json();
}

function extractJSON(text: string, isArray: boolean = false) {
  try {
    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.substring(7);
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith("```")) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    return JSON.parse(cleanText.trim());
  } catch (e) {
    try {
      const startChar = isArray ? '[' : '{';
      const endChar = isArray ? ']' : '}';
      const start = text.indexOf(startChar);
      const end = text.lastIndexOf(endChar);
      if (start !== -1 && end !== -1 && end >= start) {
        return JSON.parse(text.substring(start, end + 1));
      }
    } catch (e2) {}
    throw e;
  }
}

const app = express();
const PORT = 3000;

app.use(express.json());

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, journalContext, userName } = req.body;
    const systemInstruction = `
      You are "Santi", a warm, empathetic, and encouraging mindfulness coach dedicated to supporting students. You speak with a friendly, conversational tone, like a supportive mentor.
      
      Guidelines:
      1. Be Warm & Welcoming: If the user just greets you, respond enthusiastically and ask how their day is going or how you can support them. Don't jump into giving advice unless they share a problem.
      2. Show Empathy: Always validate the user's feelings first when they discuss stress, anxiety, or low energy. Let them know they are heard.
      3. Provide Actionable, Bite-Sized Advice: When offering help, suggest 1 or 2 small, practical mindfulness or well-being exercises (like breathing techniques or a quick stretch).
      4. Keep it Conversational: Avoid sounding like a textbook. Keep your responses short, sweet, and easy to read (3-4 sentences max unless asked to elaborate).
      5. Use Emojis: Sparingly use emojis to keep the conversation light and friendly.
      
      You have access to the last 7 days of wellness data for ${userName}:
      ${JSON.stringify(journalContext, null, 2)}
      
      Use this data gently to personalize your advice if relevant (e.g., "I noticed your sleep has been low lately...").
    `;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY environment variable is required');

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "Modern School App"
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [
          { role: "system", content: systemInstruction },
          ...messages.map((m: any) => ({
            role: m.role === 'ai' ? 'assistant' : m.role,
            content: m.content
          }))
        ],
        stream: true
      })
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!response.ok || !response.body) {
      res.write(`data: {"error": "API Error ${response.status}"}\n\n`);
      res.end();
      return;
    }

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (error) {
    console.error("OpenRouter API Error:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

app.post("/api/wellness-insights", async (req, res) => {
  try {
    const { data, role } = req.body;
    const prompt = `Analyze the following wellness data for a ${role} in a school context: ${JSON.stringify(data)}. Provide high-level insights, potential risks, and 3 actionable recommendations. CRITICAL: Be extremely crisp, precise, and to the point. Use bullet points for recommendations. Limit the summary to 2 sentences max.\n\nFormat your response as a JSON object with: { "summary": "...", "risks": ["..."], "recommendations": [{"title": "...", "content": "...", "type": "..."}] }`;
    
    const response = await callOpenRouter(
      [{ role: "user", content: prompt }],
      "deepseek/deepseek-chat",
      "You are a wellness analyst for schools. Respond only in valid JSON.",
      true
    );
    const json = extractJSON(response.choices[0].message.content, false);
    res.json(json);
  } catch (error) {
    console.error("AI Insight error:", error);
    res.status(500).json({ error: "Failed to generate insights" });
  }
});

app.post("/api/recipe-suggestions", async (req, res) => {
  try {
    const { deficiencies } = req.body;
    const prompt = `Generate 3 healthy, culturally relevant, and budget-friendly meal ideas for a student who lacks: ${deficiencies.join(", ")}. Provide: 1. Breakfast Idea 2. Lunch Box Recipe 3. Healthy Snack\n\nFormat as JSON Array: [{"mealType": "...", "name": "...", "benefits": "...", "ingredients": ["..."]}]`;
    
    const response = await callOpenRouter(
      [{ role: "user", content: prompt }],
      "deepseek/deepseek-chat",
      "You are a nutrition expert. Respond only in valid JSON Array.",
      true
    );
    const json = extractJSON(response.choices[0].message.content, true);
    res.json(json);
  } catch (error) {
    console.error("AI Recipe error:", error);
    res.status(500).json({ error: "Failed to generate recipes" });
  }
});

app.post("/api/journal-risk", async (req, res) => {
  try {
    const { journalData } = req.body;
    const prompt = `Analyze this student journal entry for immediate emotional or mental health risks. Data: Mood Score: ${journalData?.mood}/100, Stress Level: ${journalData?.stress}/100, Energy Level: ${journalData?.energy}/100, Sleep: ${journalData?.sleep}h, Note: "${journalData?.note}". Determine if this student is at risk of severe emotional distress, bullying, or self-harm based on the narrative and scores.\n\nFormat response as JSON: { "isAtRisk": boolean, "severity": "medium" | "high" | "critical", "alertType": "low_mood" | "high_stress" | "low_energy", "reason": "Brief explanation" }`;
    
    const response = await callOpenRouter(
      [{ role: "user", content: prompt }],
      "deepseek/deepseek-chat",
      "You are a student wellness safety monitor. Respond only in valid JSON.",
      true
    );
    const json = extractJSON(response.choices[0].message.content, false);
    res.json(json);
  } catch (error) {
    console.error("AI Risk analysis error:", error);
    res.status(500).json({ error: "Failed to generate risk analysis" });
  }
});

app.post("/api/wellness-tip", async (req, res) => {
  try {
    const { journalData } = req.body;
    const prompt = `Based on the following recent student journal input, generate one short, personalized, actionable "Wellness Tip of the Day" (max 2 sentences). Data: Mood: ${journalData?.mood}/100, Stress: ${journalData?.stress}/100, Sleep: ${journalData?.sleep}h, Focus: ${journalData?.focus}/100, Note: "${journalData?.note}"`;
    
    const response = await callOpenRouter(
      [{ role: "user", content: prompt }],
      "deepseek/deepseek-chat",
      "You are a friendly student wellness assistant."
    );
    res.json({ tip: response.choices[0].message.content });
  } catch (error) {
    console.error("AI Wellness Tip error:", error);
    res.status(500).json({ error: "Failed to generate wellness tip" });
  }
});

if (process.env.NODE_ENV !== "production") {
  createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  }).then(vite => {
    app.use(vite.middlewares);
    if (!process.env.VERCEL) {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    }
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

export default app;
