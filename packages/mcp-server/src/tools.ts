import type { RadarItem, Section } from "./schema.js";
import { Section as SectionEnum } from "./schema.js";
import { collect, ADAPTERS } from "./collect.js";
import type { Fetcher } from "./adapters/types.js";

export async function handleCollect(
  input: { section: string; since?: string; limit?: number; fetcher?: Fetcher },
  now: Date = new Date(),
): Promise<{ items: RadarItem[]; warnings: string[] }> {
  const section = SectionEnum.parse(input.section) as Section;
  const since = input.since ? new Date(input.since) : new Date(now.getTime() - 7 * 86_400_000);
  const limit = input.limit ?? 15;
  return collect({ section, since, limit, now, fetcher: input.fetcher });
}

export function handleSources(): { section: Section; sources: string[] }[] {
  return (Object.keys(ADAPTERS) as Section[]).map((section) => ({
    section,
    sources: ADAPTERS[section]?.sources ?? [],
  }));
}
