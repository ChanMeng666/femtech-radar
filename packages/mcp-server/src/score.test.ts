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

test("score is deterministic", () => {
  const args = { title: "femtech", summary: "", popularity: 10, published_at: "2026-06-28T00:00:00Z", now };
  expect(scoreItem(args)).toBe(scoreItem(args));
});
