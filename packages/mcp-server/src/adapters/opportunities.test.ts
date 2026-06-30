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

test("opportunities adapter drops LinkedIn cards with no jobUrl", async () => {
  const CARD_NO_URL = `<li>
  <h3 class="base-search-card__title">Senior FemTech Engineer</h3>
  <h4 class="base-search-card__subtitle"><a class="hidden-nested-link" href="https://www.linkedin.com/company/beta">Beta Health</a></h4>
  <span class="job-search-card__location">New York</span>
  <time datetime="2026-06-28">3 days ago</time>
</li>`;
  const HTML_TWO = `<ul>${CARD}${CARD_NO_URL}</ul>`;
  const items = await opportunitiesAdapter.collect({
    since: new Date("2026-06-01T00:00:00Z"), limit: 10, now: new Date("2026-06-30T00:00:00Z"),
    fetcher: async () => HTML_TWO,
  });
  expect(items).toHaveLength(1);
  expect(items[0].url).toBe("https://www.linkedin.com/jobs/view/123");
});

test("opportunities adapter uses now fallback for unparseable LinkedIn date", async () => {
  const CARD_BAD_DATE = `<li>
  <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/456?trk=x"></a>
  <h3 class="base-search-card__title">Health Data Analyst</h3>
  <h4 class="base-search-card__subtitle"><a class="hidden-nested-link" href="https://www.linkedin.com/company/acme">Acme Health</a></h4>
  <span class="job-search-card__location">Remote</span>
  <time datetime="garbage">just now</time>
</li>`;
  const now = new Date("2026-06-30T00:00:00Z");
  const items = await opportunitiesAdapter.collect({
    since: new Date("2026-06-01T00:00:00Z"), limit: 10, now,
    fetcher: async () => `<ul>${CARD_BAD_DATE}</ul>`,
  });
  expect(items).toHaveLength(1);
  expect(items[0].published_at).toBe(now.toISOString());
});

test("opportunities adapter rejects when the fetcher throws", async () => {
  await expect(opportunitiesAdapter.collect({
    since: new Date(0), limit: 10, now: new Date(),
    fetcher: async () => { throw new Error("429"); },
  })).rejects.toThrow();
});

test("opportunities adapter uses SerpAPI when SERP_API_KEY is set", async () => {
  const prev = process.env.SERP_API_KEY; process.env.SERP_API_KEY = "k";
  try {
    const JSON_FIX = JSON.stringify({ jobs_results: [{
      title: "Women's Health Data Scientist", company_name: "Acme",
      location: "Remote", description: "Build models.",
      detected_extensions: { posted_at: "2 days ago" },
      apply_options: [{ link: "https://jobs.example/abc" }],
    }]});
    const items = await opportunitiesAdapter.collect({
      since: new Date(0), limit: 10, now: new Date("2026-06-30T00:00:00Z"),
      fetcher: async (url) => { expect(url).toContain("serpapi.com"); return JSON_FIX; },
    });
    expect(items[0]).toMatchObject({ section: "opportunities", source: "Google Jobs", url: "https://jobs.example/abc" });
  } finally { if (prev === undefined) delete process.env.SERP_API_KEY; else process.env.SERP_API_KEY = prev; }
});
