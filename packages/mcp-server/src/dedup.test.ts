import { expect, test } from "vitest";
import { canonicalUrl, jaccard, titleTokens, dedupe } from "./dedup.js";
import type { RadarItem } from "./schema.js";

test("canonicalUrl strips tracking params and trailing slash", () => {
  expect(canonicalUrl("https://A.test/Path/?utm_source=x&id=2#frag"))
    .toBe("https://a.test/Path?id=2");
});

test("jaccard of identical token sets is 1", () => {
  expect(jaccard(titleTokens("Femtech funding round"), titleTokens("femtech FUNDING round"))).toBe(1);
});

const mk = (over: Partial<RadarItem>): RadarItem => ({
  id: "x", section: "industry", title: "t", url: "https://x.test/a", source: "s",
  summary: "", score: 10, published_at: "2026-06-30T00:00:00Z", ...over,
});

test("dedupe drops same-URL items, keeping higher score", () => {
  const out = dedupe([
    mk({ id: "1", url: "https://x.test/a?utm_source=q", score: 10 }),
    mk({ id: "2", url: "https://x.test/a", score: 40 }),
  ]);
  expect(out).toHaveLength(1);
  expect(out[0].id).toBe("2");
});

test("dedupe drops near-duplicate titles", () => {
  const out = dedupe([
    mk({ id: "1", url: "https://x.test/a", title: "FemTech startup raises 10M", score: 20 }),
    mk({ id: "2", url: "https://y.test/b", title: "femtech startup raises 10m", score: 50 }),
  ]);
  expect(out).toHaveLength(1);
  expect(out[0].id).toBe("2");
});
