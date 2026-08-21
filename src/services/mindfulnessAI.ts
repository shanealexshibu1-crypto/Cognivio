import { StudentJournal } from "../types";
import { format } from "date-fns";

export async function getMindfulnessAdvice(
  userQuestion: string, 
  recentJournals: StudentJournal[],
  userName: string,
  onChunk?: (text: string) => void
) {
  const journalContext = recentJournals.map(j => ({
    date: format(new Date(j.date), 'MMM dd, yyyy'),
    mood: j.mood,
    stress: j.stress,
    energy: j.energy,
    sleep: j.sleep,
    focus: j.focus,
    happiness: j.happiness,
    anxiety: j.anxiety,
    social: j.social,
    motivation: j.motivation,
    note: j.note
  }));

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: userQuestion,
        journalContext,
        userName
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    if (reader) {
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            let data;
            try {
              data = JSON.parse(line.slice(6));
            } catch (e) {
              continue;
            }
            if (data.error) throw new Error(data.error);
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              const cleanText = fullText.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*/g, '');
              if (onChunk && cleanText.trim().length > 0) onChunk(cleanText);
            }
          }
        }
      }
    }
    
    return fullText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  } catch (error) {
    console.error("AI Error:", error);
    throw new Error("I'm having trouble connecting to my mindfulness circuits right now. Please try again in a moment.");
  }
}