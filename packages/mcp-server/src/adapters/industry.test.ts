import { expect, test } from "vitest";
import { industryAdapter } from "./industry.js";

const FIXTURE = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>FemTech startup raises $20M Series A</title>
    <link>https://news.test/femtech-series-a</link>
    <description>Funding for women's health platform.</description>
    <pubDate>Mon, 29 Jun 2026 10:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

test("industry adapter parses Google News RSS into a scored RadarItem", async () => {
  const items = await industryAdapter.collect({
    since: new Date("2026-06-01T00:00:00Z"), limit: 10,
    now: new Date("2026-06-30T00:00:00Z"), fetcher: async () => FIXTURE,
  });
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    section: "industry", source: "Google News",
    url: "https://news.test/femtech-series-a",
  });
  expect(items[0].score).toBeGreaterThan(0);
});

test("industry adapter rejects when fetcher throws", async () => {
  await expect(industryAdapter.collect({
    since: new Date("2026-06-01T00:00:00Z"), limit: 10,
    now: new Date("2026-06-30T00:00:00Z"),
    fetcher: async () => { throw new Error("network"); },
  })).rejects.toThrow();
});
