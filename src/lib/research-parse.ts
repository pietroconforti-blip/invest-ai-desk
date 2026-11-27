export type ResearchBody = {
  headline: string;
  facts: string[];
  interpretation: string;
  risks: string[];
  bullCase: string[];
  bearCase: string[];
  newsRead: string;
  assumptions: string[];
};

function strings(value: unknown, max: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = item.trim().slice(0, maxLen);
    if (!text) continue;
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

export function parseResearchJson(text: string): ResearchBody | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const row = parsed as Record<string, unknown>;
  const headline = typeof row.headline === "string" ? row.headline.trim().slice(0, 220) : "";
  const interpretation = typeof row.interpretation === "string" ? row.interpretation.trim().slice(0, 1200) : "";
  const newsRead = typeof row.newsRead === "string" ? row.newsRead.trim().slice(0, 800) : "";
  if (!headline || !interpretation) return null;
  return {
    headline,
    interpretation,
    newsRead: newsRead || "The headlines in the feed were too thin to read.",
    facts: strings(row.facts, 6, 280),
    risks: strings(row.risks, 5, 280),
    bullCase: strings(row.bullCase, 4, 280),
    bearCase: strings(row.bearCase, 4, 280),
    assumptions: strings(row.assumptions, 5, 280),
  };
}
