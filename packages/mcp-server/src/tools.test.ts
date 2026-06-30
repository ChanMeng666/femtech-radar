import { expect, test } from "vitest";
import { handleCollect, handleSources } from "./tools.js";

const ARXIV_FIXTURE = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry><id>http://arxiv.org/abs/1</id><title>femtech maternal health</title>
  <summary>women's health</summary><published>2026-06-29T00:00:00Z</published></entry>
</feed>`;

test("handleCollect validates section and returns items", async () => {
  const out = await handleCollect(
    { section: "research", limit: 5, fetcher: async () => ARXIV_FIXTURE } as never,
    new Date("2026-06-30T00:00:00Z"),
  );
  expect(out.items.length).toBeGreaterThanOrEqual(1);
});

test("handleCollect rejects an invalid section", async () => {
  await expect(handleCollect({ section: "bogus" } as never)).rejects.toThrow();
});

test("handleSources lists configured adapters", () => {
  const rows = handleSources();
  expect(rows.find((r) => r.section === "research")?.sources).toContain("arXiv");
  expect(rows.find((r) => r.section === "industry")?.sources).toContain("Google News");
});
