export const FEMTECH_KEYWORDS: string[] = [
  "femtech", "women's health", "womens health", "maternal", "fertility",
  "reproductive", "menopause", "menstrual", "pregnancy", "gynecology",
  "women in tech", "diversity", "girls who code",
];

function relevance(text: string, keywords: string[]): number {
  const hay = text.toLowerCase();
  let hits = 0;
  for (const k of keywords) if (hay.includes(k)) hits++;
  return Math.min(1, hits / 3); // 3+ keyword hits saturates relevance
}

function popularityScore(popularity: number): number {
  return Math.min(1, Math.log10(Math.max(1, popularity) + 1) / 3); // ~1000 saturates
}

function freshness(published_at: string, now: Date): number {
  const ageDays = (now.getTime() - new Date(published_at).getTime()) / 86_400_000;
  if (Number.isNaN(ageDays)) return 0;
  return Math.max(0, 1 - ageDays / 30); // linear decay over 30 days
}

export function scoreItem(input: {
  title: string; summary: string; popularity: number;
  published_at: string; now: Date; keywords?: string[];
}): number {
  const kw = input.keywords ?? FEMTECH_KEYWORDS;
  const rel = relevance(`${input.title} ${input.summary}`, kw);
  const pop = popularityScore(input.popularity);
  const fresh = freshness(input.published_at, input.now);
  const raw = 0.5 * rel + 0.3 * pop + 0.2 * fresh; // weights sum to 1
  return Math.round(raw * 100);
}
