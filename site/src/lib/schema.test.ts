import { describe, expect, test } from 'vitest';
import { WeeklyDataWithWhySchema } from './schema';

const validItem = {
  id: 'abc123',
  section: 'research',
  title: 'A paper',
  url: 'http://arxiv.org/abs/2606.29467v1',
  source: 'arXiv',
  summary: 'An abstract.',
  score: 55,
  published_at: '2026-06-28T15:51:53Z',
  why_it_matters: 'It matters because reasons.',
};
const valid = {
  week: '2026-W27',
  generated_at: '2026-06-30T00:00:00Z',
  editor_note: 'hi',
  sections: { industry: [], research: [validItem], opportunities: [], discussions: [] },
};

describe('WeeklyDataWithWhySchema', () => {
  test('keeps why_it_matters after parsing (guards the strip bug)', () => {
    const parsed = WeeklyDataWithWhySchema.parse(valid);
    expect(parsed.sections.research[0].why_it_matters).toBe('It matters because reasons.');
  });

  test('rejects an object missing a section', () => {
    const bad = { ...valid, sections: { industry: [], research: [] } };
    expect(() => WeeklyDataWithWhySchema.parse(bad)).toThrow();
  });
});
