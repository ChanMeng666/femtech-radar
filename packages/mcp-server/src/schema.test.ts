import { expect, test } from "vitest";
import { RadarItemSchema, WeeklyDataSchema } from "./schema.js";

const item = {
  id: "abc", section: "research", title: "A study",
  url: "https://x.test/a", source: "arXiv", summary: "...",
  score: 42, published_at: "2026-06-30T00:00:00Z",
};

test("RadarItemSchema accepts a valid item", () => {
  expect(RadarItemSchema.parse(item)).toMatchObject({ id: "abc", score: 42 });
});

test("RadarItemSchema rejects an out-of-range score", () => {
  expect(() => RadarItemSchema.parse({ ...item, score: 101 })).toThrow();
});

test("WeeklyDataSchema requires all four sections", () => {
  const wd = {
    week: "2026-W27", generated_at: "2026-06-30T00:00:00Z", editor_note: "hi",
    sections: { industry: [], research: [item], opportunities: [], discussions: [] },
  };
  expect(WeeklyDataSchema.parse(wd).sections.research).toHaveLength(1);
});
