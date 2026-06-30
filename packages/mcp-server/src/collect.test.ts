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

test("collect returns a warning for a section with no adapter", async () => {
  const { items, warnings } = await collect({
    section: "discussions", since: new Date("2026-06-01T00:00:00Z"),
    limit: 10, now: new Date("2026-06-30T00:00:00Z"), fetcher: async () => "",
  });
  expect(items).toEqual([]);
  expect(warnings[0]).toMatch(/no adapter/);
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
