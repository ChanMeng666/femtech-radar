import type { CollectionEntry } from "astro:content";
import type { WeeklyDataWithWhy } from "./schema";

export function getWeeks(entries: CollectionEntry<"radar">[]): WeeklyDataWithWhy[] {
  return entries.map((e) => e.data as WeeklyDataWithWhy);
}

export function safeISODate(s: string): string {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
