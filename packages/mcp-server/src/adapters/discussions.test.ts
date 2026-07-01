import { expect, test } from "vitest";
import { discussionsAdapter } from "./discussions.js";

const HN_FIX = JSON.stringify({
  hits: [
    {
      objectID: "111",
      title: "Show HN: a femtech cycle-tracking app",
      url: "https://example.com/post",
      points: 120,
      num_comments: 45,
      created_at: "2026-06-29T10:00:00.000Z",
    },
  ],
});

const MASTODON_FIX = JSON.stringify([
  {
    url: "https://mastodon.social/@user/1",
    uri: "https://mastodon.social/users/user/statuses/1",
    content: "<p>Great new <a>#femtech</a> resource for women's health &amp; midwives</p>",
    favourites_count: 7,
    replies_count: 2,
    created_at: "2026-06-29T08:00:00.000Z",
    account: { acct: "user@mastodon.social" },
  },
]);

// Route each request to the right fixture by host.
function routed(url: string): string {
  if (url.includes("hn.algolia.com")) return HN_FIX;
  if (url.includes("mastodon.social")) return MASTODON_FIX;
  return "[]";
}

test("discussions adapter merges Hacker News + Mastodon into RadarItems", async () => {
  const items = await discussionsAdapter.collect({
    since: new Date("2026-06-01T00:00:00Z"),
    limit: 10,
    now: new Date("2026-06-30T00:00:00Z"),
    fetcher: async (url) => routed(url),
  });

  const sources = new Set(items.map((i) => i.source));
  expect(sources.has("Hacker News")).toBe(true);
  expect(sources.has("Mastodon")).toBe(true);

  const hn = items.find((i) => i.source === "Hacker News")!;
  expect(hn).toMatchObject({ section: "discussions", url: "https://example.com/post", raw_metrics: { points: 120, comments: 45 } });

  const m = items.find((i) => i.source === "Mastodon")!;
  expect(m.url).toBe("https://mastodon.social/@user/1");
  expect(m.title).not.toContain("<"); // HTML stripped
  expect(m.title).toContain("femtech");
  expect(m.raw_metrics).toEqual({ points: 7, comments: 2 });
  expect(m.score).toBeGreaterThan(0);

  // Multi-term (HN) / multi-tag (Mastodon) queries are de-duplicated by URL.
  expect(items.filter((i) => i.url === "https://example.com/post")).toHaveLength(1);
  expect(items.filter((i) => i.url === "https://mastodon.social/@user/1")).toHaveLength(1);
});

test("discussions adapter degrades per-source: HN failing still yields Mastodon items", async () => {
  const items = await discussionsAdapter.collect({
    since: new Date("2026-06-01T00:00:00Z"),
    limit: 10,
    now: new Date("2026-06-30T00:00:00Z"),
    fetcher: async (url) => {
      if (url.includes("hn.algolia.com")) throw new Error("429 rate limited");
      return routed(url);
    },
  });
  expect(items.length).toBeGreaterThan(0);
  expect(items.every((i) => i.section === "discussions")).toBe(true);
  expect(items.some((i) => i.source === "Mastodon")).toBe(true);
  expect(items.some((i) => i.source === "Hacker News")).toBe(false);
});

test("discussions adapter returns [] (never throws) when every source fails", async () => {
  const items = await discussionsAdapter.collect({
    since: new Date("2026-06-01T00:00:00Z"),
    limit: 10,
    now: new Date("2026-06-30T00:00:00Z"),
    fetcher: async () => {
      throw new Error("network down");
    },
  });
  expect(items).toEqual([]);
});
