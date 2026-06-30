import type { RadarItem } from "./schema.js";

export function canonicalUrl(url: string): string {
  const u = new URL(url);
  u.hostname = u.hostname.toLowerCase();
  u.hash = "";
  for (const k of [...u.searchParams.keys()]) {
    if (k.toLowerCase().startsWith("utm_") || k.toLowerCase() === "fbclid") u.searchParams.delete(k);
  }
  let s = u.toString();
  s = s.replace(/\/(\?|$)/, "$1").replace(/\?$/, "");
  return s;
}

export function titleTokens(title: string): Set<string> {
  return new Set(title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export function dedupe(items: RadarItem[], threshold = 0.8): RadarItem[] {
  const kept: { item: RadarItem; url: string; tokens: Set<string> }[] = [];
  for (const item of [...items].sort((x, y) => y.score - x.score)) {
    const url = canonicalUrl(item.url);
    const tokens = titleTokens(item.title);
    const dup = kept.find((k) => k.url === url || jaccard(k.tokens, tokens) >= threshold);
    if (!dup) kept.push({ item, url, tokens });
  }
  return kept.map((k) => k.item);
}
