import type { WeeklyDataWithWhy } from './schema';

export function sortWeeksDesc(weeks: WeeklyDataWithWhy[]): WeeklyDataWithWhy[] {
  return [...weeks].sort((a, b) => (a.week < b.week ? 1 : a.week > b.week ? -1 : 0));
}

export function latestWeek(weeks: WeeklyDataWithWhy[]): WeeklyDataWithWhy | undefined {
  return sortWeeksDesc(weeks)[0];
}

export function getWeek(weeks: WeeklyDataWithWhy[], key: string): WeeklyDataWithWhy | undefined {
  return weeks.find((w) => w.week === key);
}
