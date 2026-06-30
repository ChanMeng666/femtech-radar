import { expect, test } from "vitest";
import { scoreItem } from "./score.js";

const now = new Date("2026-06-30T00:00:00Z");

test("fresh, on-topic, popular item scores higher than stale off-topic one", () => {
  const hot = scoreItem({
    title: "FemTech maternal health AI startup", summary: "women's health funding",
    popularity: 500, published_at: "2026-06-29T00:00:00Z", now,
  });
  const cold = scoreItem({
    title: "Generic database benchmark", summary: "unrelated",
    popularity: 1, published_at: "2026-01-01T00:00:00Z", now,
  });
  expect(hot).toBeGreaterThan(cold);
  expect(hot).toBeLessThanOrEqual(100);
  expect(cold).toBeGreaterThanOrEqual(0);
});

test("score is deterministic for equal inputs built independently", () => {
  const a = scoreItem({ title: "femtech", summary: "", popularity: 10, published_at: "2026-06-28T00:00:00Z", now: new Date("2026-06-30T00:00:00Z") });
  const b = scoreItem({ title: "femtech", summary: "", popularity: 10, published_at: "2026-06-28T00:00:00Z", now: new Date("2026-06-30T00:00:00Z") });
  expect(a).toBe(b);
});

test("future-dated item still scores within 0..100", () => {
  const s = scoreItem({ title: "femtech maternal health", summary: "women's health", popularity: 500, published_at: "2026-12-31T00:00:00Z", now: new Date("2026-06-30T00:00:00Z") });
  expect(s).toBeGreaterThanOrEqual(0);
  expect(s).toBeLessThanOrEqual(100);
});

test("unparseable published_at scores within 0..100", () => {
  const s = scoreItem({ title: "femtech", summary: "", popularity: 10, published_at: "not-a-date", now: new Date("2026-06-30T00:00:00Z") });
  expect(s).toBeGreaterThanOrEqual(0);
  expect(s).toBeLessThanOrEqual(100);
});
