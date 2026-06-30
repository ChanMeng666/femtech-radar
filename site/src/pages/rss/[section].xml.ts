import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { getWeeks } from '../../lib/content';
import { toRssItems } from '../../lib/rss';
import { SECTION_KEYS } from '../../lib/schema';

export function getStaticPaths() {
  return SECTION_KEYS.map((section) => ({ params: { section } }));
}

export async function GET(context: APIContext) {
  const section = context.params.section as string;
  const weeks = getWeeks(await getCollection('radar'));
  const items = toRssItems(weeks).filter((i) => i.categories[0] === section);
  return rss({
    title: `FemTech Radar — ${section}`,
    description: `FemTech Radar ${section} feed.`,
    site: new URL(import.meta.env.BASE_URL, context.site ?? 'https://chanmeng666.github.io').toString(),
    items: items.map((i) => ({
      title: i.title,
      link: i.link,
      pubDate: i.pubDate,
      description: i.description,
      categories: i.categories,
    })),
  });
}
