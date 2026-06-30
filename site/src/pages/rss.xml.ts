import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { toRssItems } from '../lib/rss';
import type { WeeklyDataWithWhy } from '../lib/schema';

export async function GET(context: APIContext) {
  const entries = await getCollection('radar');
  const weeks = entries.map((e) => e.data as WeeklyDataWithWhy);
  return rss({
    title: 'FemTech Radar',
    description: 'A weekly, curated digest of FemTech industry news and women’s-health research.',
    site: new URL(import.meta.env.BASE_URL, context.site ?? 'https://chanmeng666.github.io').toString(),
    items: toRssItems(weeks).map((i) => ({
      title: i.title,
      link: i.link,
      pubDate: i.pubDate,
      description: i.description,
      categories: i.categories,
    })),
  });
}
