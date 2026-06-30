import type { WeeklyDataWithWhy } from './schema';
import { SECTION_KEYS } from './schema';
import { stripHtml, truncate } from './strip-html';

export interface RssItem {
  title: string;
  link: string;
  guid: string;
  pubDate: Date | undefined;
  description: string;
  categories: string[];
}

export function toRssItems(weeks: WeeklyDataWithWhy[]): RssItem[] {
  const items: RssItem[] = [];
  for (const week of weeks) {
    for (const key of SECTION_KEYS) {
      for (const it of week.sections[key]) {
        const why = it.why_it_matters ? `${it.why_it_matters} ` : '';
        const summary = truncate(stripHtml(it.summary), 280);
        const d = new Date(it.published_at);
        items.push({
          title: it.title,
          link: it.url,
          guid: it.id,
          pubDate: Number.isNaN(d.getTime()) ? undefined : d,
          description: `${why}${summary}`.trim(),
          categories: [key],
        });
      }
    }
  }
  return items.sort((a, b) => (b.pubDate?.getTime() ?? 0) - (a.pubDate?.getTime() ?? 0));
}
