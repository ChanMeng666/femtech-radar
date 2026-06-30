import type { RadarItem, Section } from "./schema.js";
import { dedupe } from "./dedup.js";
import type { Adapter, Fetcher } from "./adapters/types.js";
import { industryAdapter } from "./adapters/industry.js";
import { researchAdapter } from "./adapters/research.js";
import { opportunitiesAdapter } from "./adapters/opportunities.js";

export const httpFetcher: Fetcher = async (url, init): Promise<string> => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "femtech-radar", ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
};

export const ADAPTERS: Record<Section, Adapter | null> = {
  industry: industryAdapter,
  research: researchAdapter,
  opportunities: opportunitiesAdapter,
  discussions: null,
};

export async function collect(args: {
  section: Section; since: Date; limit: number; now: Date;
  fetcher?: Fetcher; keywords?: string[];
}): Promise<{ items: RadarItem[]; warnings: string[] }> {
  const adapter = ADAPTERS[args.section];
  if (!adapter) return { items: [], warnings: [`no adapter for ${args.section}`] };
  const fetcher = args.fetcher ?? httpFetcher;
  const warnings: string[] = [];
  let raw: RadarItem[] = [];
  try {
    raw = await adapter.collect({ since: args.since, limit: args.limit, now: args.now, fetcher, keywords: args.keywords });
  } catch (err) {
    warnings.push(`${args.section} adapter failed: ${(err as Error).message}`);
  }
  const deduped = dedupe(raw).sort((a, b) => b.score - a.score);
  const sinceMs = args.since.getTime();
  const within = deduped.filter((i) => {
    const t = new Date(i.published_at).getTime();
    return Number.isNaN(t) || t >= sinceMs;
  });
  const items = within.slice(0, args.limit);
  return { items, warnings };
}
