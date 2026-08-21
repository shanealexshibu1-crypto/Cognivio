export async function getWellnessInsights(data: any, role: string) {
  try {
    const response = await fetch("/api/wellness-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, role })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("AI Insight error:", error);
    return null;
  }
}

export async function getRecipeSuggestions(deficiencies: string[]) {
  try {
    const response = await fetch("/api/recipe-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deficiencies })
    });
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error("AI Recipe error:", error);
    return [];
  }
}

export async function analyzeJournalRisk(journalData: any) {
  try {
    const response = await fetch("/api/journal-risk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ journalData })
    });
    if (!response.ok) return { isAtRisk: false };
    return await response.json();
  } catch (error) {
    console.error("AI Risk analysis error:", error);
    return { isAtRisk: false };
  }
}

export async function getWellnessTip(journalData: any) {
  try {
    const response = await fetch("/api/wellness-tip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ journalData })
    });
    if (!response.ok) return "Take a deep breath and stay hydrated today.";
    const data = await response.json();
    return data.tip || "Take a deep breath and stay hydrated today.";
  } catch (error) {
    console.error("AI Wellness Tip error:", error);
    return "Take a deep breath and stay hydrated today.";
  }
}