import { expect, test } from "vitest";
import { collect } from "./collect.js";

const ARXIV_FIXTURE = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry><id>http://arxiv.org/abs/1</id><title>femtech maternal health</title>
  <summary>women's health</summary><published>2026-06-29T00:00:00Z</published></entry>
  <entry><id>http://arxiv.org/abs/2</id><title>femtech maternal health</title>
  <summary>women's health</summary><published>2026-06-29T00:00:00Z</published></entry>
</feed>`;

test("collect dedupes and returns items sorted by score", async () => {
  const { items, warnings } = await collect({
    section: "research", since: new Date("2026-06-01T00:00:00Z"),
    limit: 10, now: new Date("2026-06-30T00:00:00Z"),
    fetcher: async () => ARXIV_FIXTURE,
  });
  expect(items).toHaveLength(1); // two identical titles deduped
  expect(warnings).toEqual([]);
});

test("collect surfaces a warning when the discussions adapter receives invalid JSON", async () => {
  const { items, warnings } = await collect({
    section: "discussions", since: new Date("2026-06-01T00:00:00Z"),
    limit: 10, now: new Date("2026-06-30T00:00:00Z"), fetcher: async () => "",
  });
  expect(items).toEqual([]);
  expect(warnings[0]).toMatch(/discussions adapter failed/);
});

test("collect surfaces a warning (and empty items) when the source fails", async () => {
  const { items, warnings } = await collect({
    section: "research", since: new Date("2026-06-01T00:00:00Z"),
    limit: 10, now: new Date("2026-06-30T00:00:00Z"),
    fetcher: async () => { throw new Error("boom"); },
  });
  expect(items).toEqual([]);
  expect(warnings.length).toBeGreaterThan(0);
  expect(warnings[0]).toMatch(/research adapter failed/);
});

test("collect filters out items published before `since`", async () => {
  const FIXTURE = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry><id>http://arxiv.org/abs/20</id><title>femtech maternal health recent</title>
  <summary>women's health</summary><published>2026-06-20T00:00:00Z</published></entry>
  <entry><id>http://arxiv.org/abs/21</id><title>femtech older paper archived</title>
  <summary>women's health</summary><published>2026-01-01T00:00:00Z</published></entry>
</feed>`;
  const { items } = await collect({
    section: "research", since: new Date("2026-06-01T00:00:00Z"),
    limit: 10, now: new Date("2026-06-30T00:00:00Z"),
    fetcher: async () => FIXTURE,
  });
  expect(items).toHaveLength(1);
  expect(items[0].url).toBe("http://arxiv.org/abs/20");
});

test("collect sorts surviving items by score descending", async () => {
  const TWO_DISTINCT = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry><id>http://arxiv.org/abs/10</id><title>femtech maternal health fertility study</title>
  <summary>women's health</summary><published>2026-06-29T00:00:00Z</published></entry>
  <entry><id>http://arxiv.org/abs/11</id><title>generic compiler optimization techniques</title>
  <summary>unrelated</summary><published>2026-06-01T00:00:00Z</published></entry>
</feed>`;
  const { items, warnings } = await collect({
    section: "research", since: new Date("2026-06-01T00:00:00Z"),
    limit: 10, now: new Date("2026-06-30T00:00:00Z"),
    fetcher: async () => TWO_DISTINCT,
  });
  expect(warnings).toEqual([]);
  expect(items).toHaveLength(2);
  expect(items[0].title).toMatch(/femtech/);
  expect(items[0].score).toBeGreaterThanOrEqual(items[1].score);
});
