import type { WeeklyDataWithWhy } from './schema';
import { SECTION_KEYS } from './schema';
import { stripHtml, truncate } from './strip-html';

export interface RssItem {
  title: string;
  link: string;
  guid: string;
  pubDate: Date;
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
        items.push({
          title: it.title,
          link: it.url,
          guid: it.id,
          pubDate: new Date(it.published_at),
          description: `${why}${summary}`.trim(),
          categories: [key],
        });
      }
    }
  }
  return items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}
