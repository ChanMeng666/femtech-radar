import { expect, test } from "vitest";
import { opportunitiesAdapter } from "./opportunities.js";

const CARD = `<li>
  <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/123?trk=x"></a>
  <h3 class="base-search-card__title">FemTech Product Manager</h3>
  <h4 class="base-search-card__subtitle"><a class="hidden-nested-link" href="https://www.linkedin.com/company/acme">Acme Health</a></h4>
  <span class="job-search-card__location">Remote</span>
  <time datetime="2026-06-29">2 days ago</time>
</li>`;
const HTML = `<ul>${CARD}</ul>`;

test("opportunities adapter parses a LinkedIn job card into a RadarItem", async () => {
  const items = await opportunitiesAdapter.collect({
    since: new Date("2026-06-01T00:00:00Z"), limit: 10, now: new Date("2026-06-30T00:00:00Z"),
    fetcher: async () => HTML,
  });
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    section: "opportunities", source: "LinkedIn",
    url: "https://www.linkedin.com/jobs/view/123",
    title: "FemTech Product Manager",
  });
  expect(items[0].summary).toContain("Acme Health");
  expect(items[0].published_at).toBe("2026-06-29T00:00:00.000Z");
  expect(items[0].score).toBeGreaterThan(0);
});

test("opportunities adapter rejects when the fetcher throws", async () => {
  await expect(opportunitiesAdapter.collect({
    since: new Date(0), limit: 10, now: new Date(),
    fetcher: async () => { throw new Error("429"); },
  })).rejects.toThrow();
});
