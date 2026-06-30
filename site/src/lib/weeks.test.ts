import { describe, expect, test } from 'vitest';
import { getWeek, latestWeek, sortWeeksDesc } from './weeks';
import type { WeeklyDataWithWhy } from './schema';

const mk = (week: string): WeeklyDataWithWhy => ({
  week,
  generated_at: '2026-01-01T00:00:00Z',
  editor_note: '',
  sections: { industry: [], research: [], opportunities: [], discussions: [] },
});
const weeks = [mk('2026-W26'), mk('2026-W27'), mk('2026-W25')];

describe('weeks helpers', () => {
  test('sortWeeksDesc orders newest first without mutating input', () => {
    const sorted = sortWeeksDesc(weeks);
    expect(sorted.map((w) => w.week)).toEqual(['2026-W27', '2026-W26', '2026-W25']);
    expect(weeks[0].week).toBe('2026-W26');
  });
  test('latestWeek returns the newest', () => {
    expect(latestWeek(weeks)?.week).toBe('2026-W27');
  });
  test('getWeek finds by key', () => {
    expect(getWeek(weeks, '2026-W26')?.week).toBe('2026-W26');
    expect(getWeek(weeks, '2026-W99')).toBeUndefined();
  });
});
