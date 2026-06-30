import { expect, test } from "vitest";
import { discussionsAdapter } from "./discussions.js";
const FIX = JSON.stringify({ hits: [{
  objectID: "111", title: "Show HN: a femtech cycle-tracking app", url: "https://example.com/post",
  points: 120, num_comments: 45, created_at: "2026-06-29T10:00:00.000Z",
}]});
test("discussions adapter maps an HN hit to a RadarItem with metrics", async () => {
  const items = await discussionsAdapter.collect({
    since: new Date("2026-06-01T00:00:00Z"), limit: 10, now: new Date("2026-06-30T00:00:00Z"),
    fetcher: async (url) => { expect(url).toContain("hn.algolia.com"); return FIX; },
  });
  expect(items[0]).toMatchObject({
    section: "discussions", source: "Hacker News", url: "https://example.com/post",
    raw_metrics: { points: 120, comments: 45 },
  });
  expect(items[0].score).toBeGreaterThan(0);
});
test("discussions adapter rejects when the fetcher throws", async () => {
  await expect(discussionsAdapter.collect({ since: new Date(0), limit: 10, now: new Date(),
    fetcher: async () => { throw new Error("boom"); } })).rejects.toThrow();
});
