import { expect, test } from "vitest";
import { researchAdapter } from "./research.js";

const FIXTURE = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2606.0001v1</id>
    <title>AI for maternal health monitoring</title>
    <summary>A femtech study on pregnancy.</summary>
    <published>2026-06-29T00:00:00Z</published>
  </entry>
</feed>`;

test("research adapter parses arXiv atom into a scored RadarItem", async () => {
  const items = await researchAdapter.collect({
    since: new Date("2026-06-01T00:00:00Z"),
    limit: 10, now: new Date("2026-06-30T00:00:00Z"),
    fetcher: async () => FIXTURE,
  });
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    section: "research", source: "arXiv",
    url: "http://arxiv.org/abs/2606.0001v1",
    title: "AI for maternal health monitoring",
  });
  expect(items[0].score).toBeGreaterThan(0);
});

test("research adapter rejects when fetcher throws", async () => {
  await expect(researchAdapter.collect({
    since: new Date("2026-06-01T00:00:00Z"), limit: 10,
    now: new Date("2026-06-30T00:00:00Z"),
    fetcher: async () => { throw new Error("network"); },
  })).rejects.toThrow();
});
