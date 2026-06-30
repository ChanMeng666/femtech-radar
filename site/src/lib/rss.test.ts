import { describe, expect, test } from 'vitest';
import { toRssItems } from './rss';
import type { WeeklyDataWithWhy } from './schema';

const week: WeeklyDataWithWhy = {
  week: '2026-W27',
  generated_at: '2026-06-30T00:00:00Z',
  editor_note: 'note',
  sections: {
    industry: [{
      id: 'i1', section: 'industry', title: 'FDA news', url: 'https://news.example/1',
      source: 'Google News', summary: '<a href="x">FDA news</a>&nbsp;Contemporary',
      score: 39, published_at: '2026-06-29T20:33:05.000Z', why_it_matters: 'Regulatory.',
    }],
    research: [{
      id: 'r1', section: 'research', title: 'A paper', url: 'http://arxiv.org/abs/1',
      source: 'arXiv', summary: 'An abstract.', score: 55,
      published_at: '2026-06-28T15:51:53Z', why_it_matters: 'Open benchmark.',
    }],
    opportunities: [], discussions: [],
  },
};

describe('toRssItems', () => {
  test('flattens all items, newest first, with stripped descriptions', () => {
    const items = toRssItems([week]);
    expect(items.map((i) => i.guid)).toEqual(['i1', 'r1']); // i1 is newer
    expect(items[0].link).toBe('https://news.example/1');
    expect(items[0].categories).toEqual(['industry']);
    expect(items[0].description).toContain('Regulatory.');
    expect(items[0].description).not.toContain('<a');
    expect(items[0].pubDate instanceof Date).toBe(true);
  });
});
