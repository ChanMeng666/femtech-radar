# femtech-radar vNext Implementation Plan (Plan 4): fill all 4 sections + site polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give the `opportunities` and `discussions` sections real adapters (reusing the owner's LinkedIn job projects + free Hacker News API), improve `industry` URL quality with a free Google-News redirect decoder, surface per-section RSS feeds, and clear the deferred site polish.

**Architecture:** Two new MCP adapters plug into the existing deterministic pipeline via the `ADAPTERS` registry. `opportunities` ports the dependency-free URL-build + regex parse from `linkedin-jobs-search` (free LinkedIn guest endpoint) with an opt-in SerpAPI path (ported from `server-google-jobs`) gated on `process.env.SERP_API_KEY`. `discussions` uses the free Hacker News Algolia JSON API. All network I/O stays behind the injected `Fetcher` (extended to carry optional request headers, which LinkedIn requires). The weekly workflow is updated to collect all four sections; the site gets per-section RSS + polish.

**Tech Stack:** TypeScript (strict, ESM), Node ≥ 20, Vitest, `fast-xml-parser` (existing), Astro 5, `@astrojs/rss`, `gh aw`. **No new npm dependencies** (ports use regex / `JSON.parse` / `Buffer` base64).

## Global Constraints

- Adapters route ALL network I/O through the injected `Fetcher`; **zero real network calls in tests** (inject a fake fetcher returning a fixture string).
- **No new npm dependencies.** Port the pure functions; discard the source projects' hardcoded `axios`/`fetch`/`node-fetch`.
- Adapters are deterministic and never call `new Date()` — use the injected `now`. Editorial text (`why_it_matters`, `editor_note`) stays the workflow's job, never the adapter's.
- Graceful degradation: a failing/blocked source returns `[]` (caught by `collect()` → warning), never throws out.
- Zero recurring cost: LinkedIn + Hacker News are free/keyless. SerpAPI is **opt-in only** (env-gated; inactive without `SERP_API_KEY`).
- `packages/mcp-server` uses NodeNext → relative imports need `.js` suffixes. `site/` uses Vite → extensionless imports.
- Data contract `RadarItem` (do not change its shape): `{ id, section, title, url, source, summary, score, published_at, raw_metrics? }`. `Section` already includes `opportunities`/`discussions`.
- Repo stays public. Develop on `feat/v4-vnext-sources`; never commit to `master`.

## Prerequisites

- Branch `feat/v4-vnext-sources` off `master` (done by controller).
- Port-source files to READ (owner's repos; copy pure logic, do not add as deps):
  - `D:\github_repository\linkedin-jobs-search\worker\services\linkedin.ts` (LinkedIn URL-build + regex parse).
  - `D:\github_repository\server-google-jobs\src\index.ts` (SerpAPI `google_jobs` URL params + `jobs_results` shape).

---

### Task A1: Extend the Fetcher contract (optional headers) + shared `hashId` util

**Files:**
- Modify: `packages/mcp-server/src/adapters/types.ts`
- Modify: `packages/mcp-server/src/collect.ts` (`httpFetcher`)
- Create: `packages/mcp-server/src/adapters/utils.ts`, `packages/mcp-server/src/adapters/utils.test.ts`
- Modify: `packages/mcp-server/src/adapters/industry.ts`, `packages/mcp-server/src/adapters/research.ts` (use shared `hashId`)

**Interfaces:**
- Produces: `Fetcher = (url: string, init?: { headers?: Record<string,string> }) => Promise<string>` (optional `init`, backward-compatible); `hashId(url: string): string`.

- [ ] **Step 1: Failing test for `hashId`** — `utils.test.ts`:
```ts
import { expect, test } from "vitest";
import { hashId } from "./utils.js";
test("hashId is a stable 16-char hex of the url", () => {
  expect(hashId("https://x.test/a")).toMatch(/^[0-9a-f]{16}$/);
  expect(hashId("https://x.test/a")).toBe(hashId("https://x.test/a"));
  expect(hashId("https://x.test/a")).not.toBe(hashId("https://x.test/b"));
});
```
- [ ] **Step 2: Run → FAIL** (`./utils.js` missing). `pnpm --filter @chanmeng666/femtech-radar-mcp exec vitest run src/adapters/utils.test.ts`
- [ ] **Step 3: Implement** `utils.ts`:
```ts
import { createHash } from "node:crypto";
export function hashId(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}
```
- [ ] **Step 4: Extend the `Fetcher` type** in `adapters/types.ts`:
```ts
export type Fetcher = (url: string, init?: { headers?: Record<string, string> }) => Promise<string>;
```
(Leave `CollectOpts`/`Adapter` unchanged.)
- [ ] **Step 5: Honor headers in `httpFetcher`** (`collect.ts`) — merge caller headers over the default UA:
```ts
export const httpFetcher: Fetcher = async (url, init): Promise<string> => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "femtech-radar", ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
};
```
- [ ] **Step 6: De-duplicate `hashId`** — in `industry.ts` and `research.ts`, delete the local `hashId` and `import { hashId } from "./utils.js";`.
- [ ] **Step 7: Run full MCP suite → PASS** (`pnpm --filter @chanmeng666/femtech-radar-mcp test`; existing 28 + new util test). `tsc --noEmit` clean.
- [ ] **Step 8: Commit** `feat(mcp): shared hashId util + optional headers on Fetcher`.

---

### Task A2: Google News redirect-URL decoder (free, best-effort, fallback-safe)

**Files:**
- Create: `packages/mcp-server/src/adapters/gnews-url.ts`, `packages/mcp-server/src/adapters/gnews-url.test.ts`
- Modify: `packages/mcp-server/src/adapters/industry.ts`

**Interfaces:**
- Produces: `decodeGoogleNewsURL(url: string): string` — returns the embedded publisher URL when decodable; otherwise returns the input unchanged.

- [ ] **Step 1: Failing test** — `gnews-url.test.ts`:
```ts
import { expect, test } from "vitest";
import { decodeGoogleNewsURL } from "./gnews-url.js";

// Older decodable form: base64 of a payload that contains the publisher URL.
const payload = Buffer.from(
  "\x08\x13\x22" + "https://example.com/real-article" + "\x01"
).toString("base64").replace(/=+$/, "");

test("decodes an embedded publisher URL from a CBMi-style path", () => {
  const u = `https://news.google.com/rss/articles/${payload}?oc=5`;
  expect(decodeGoogleNewsURL(u)).toBe("https://example.com/real-article");
});
test("returns the original url unchanged when not decodable", () => {
  const opaque = "https://news.google.com/rss/articles/CBMiABC123_not_base64_$$?oc=5";
  expect(decodeGoogleNewsURL(opaque)).toBe(opaque);
});
test("passes through non-google-news urls", () => {
  expect(decodeGoogleNewsURL("https://arxiv.org/abs/1")).toBe("https://arxiv.org/abs/1");
});
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** `gnews-url.ts` (pure; base64-decode the path segment, scan for an embedded `http(s)://` URL, stop at the first non-URL byte; any error → return input):
```ts
export function decodeGoogleNewsURL(url: string): string {
  try {
    if (!/news\.google\.com\/(rss\/)?articles\//.test(url)) return url;
    const seg = url.split("/articles/")[1]?.split("?")[0];
    if (!seg) return url;
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(b64, "base64").toString("binary");
    const m = decoded.match(/https?:\/\/[^\x00-\x1f"'\\ ]+/);
    if (!m) return url;
    // Trim a trailing protobuf field byte if present (best-effort).
    return m[0].replace(/[\x00-\x1f].*$/, "");
  } catch {
    return url;
  }
}
```
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Wire into `industry.ts`** — set `const itemUrl = decodeGoogleNewsURL(String(e.link));` (keep `hashId(itemUrl)` on the decoded URL). Add `import { decodeGoogleNewsURL } from "./gnews-url.js";`. Re-run `industry.test.ts` (existing fixture uses a plain `<link>`, so it passes through unchanged) — PASS.
- [ ] **Step 6: Commit** `feat(mcp): decode Google News redirect URLs to publisher URLs (fallback-safe)`.

---

### Task A3: `opportunities` adapter — LinkedIn (free)

**Files:**
- Create: `packages/mcp-server/src/adapters/opportunities.ts`, `packages/mcp-server/src/adapters/opportunities.test.ts`
- Modify: `packages/mcp-server/src/collect.ts` (register adapter)

**Interfaces:**
- Consumes: `Fetcher` (with headers), `hashId`, `scoreItem`.
- Produces: `opportunitiesAdapter: Adapter` (`section: "opportunities"`, `sources: ["LinkedIn"]`).

**Port note:** copy these pure pieces from `D:\github_repository\linkedin-jobs-search\worker\services\linkedin.ts` into the adapter file (or a sibling `linkedin.ts` helper): the filter maps (`TIME_FILTERS`, `JOB_TYPE_FILTERS`, `EXPERIENCE_FILTERS`, `REMOTE_FILTERS`, `SALARY_FILTERS`), `decodeHtmlEntities`, `buildSearchUrl`, `parseJobListings`, and a trimmed `buildQueryOptions`. **Discard** `fetchLinkedInJobs`, `searchJobs`, `searchMultipleCountries`, user-agent rotation, and pagination — the adapter does a single `fetcher()` call. Keep the regex parse verbatim (it is dependency-free).

- [ ] **Step 1: Failing test** — `opportunities.test.ts` with a minimal LinkedIn HTML fixture (one `<li>` job card matching the parser's selectors) and an injected fetcher:
```ts
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
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** `opportunities.ts`. Build the URL with the FemTech query and pass a browser UA via the new headers arg, then parse + map:
```ts
import type { RadarItem } from "../schema.js";
import { scoreItem } from "../score.js";
import { hashId } from "./utils.js";
import type { Adapter, CollectOpts } from "./types.js";
// ... ported: filter maps, decodeHtmlEntities, buildSearchUrl, parseJobListings, buildQueryOptions ...

const LINKEDIN_QUERY = 'femtech OR "women\'s health" OR "maternal health" OR "digital health"';
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function collectLinkedIn({ limit, now, fetcher, keywords }: CollectOpts): Promise<RadarItem[]> {
  const url = buildSearchUrl(buildQueryOptions({ keyword: LINKEDIN_QUERY, dateSincePosted: "past week", limit }));
  const html = await fetcher(url, { headers: { "user-agent": BROWSER_UA, "accept": "text/html" } });
  const jobs = parseJobListings(html);
  return jobs.slice(0, limit).map((j): RadarItem => {
    const summary = [j.company, j.location, j.salary].filter(Boolean).join(" · ");
    const published_at = j.date ? new Date(j.date).toISOString() : now.toISOString();
    return {
      id: hashId(j.jobUrl), section: "opportunities", title: j.position, url: j.jobUrl,
      source: "LinkedIn", summary,
      score: scoreItem({ title: j.position, summary, popularity: 0, published_at, now, keywords }),
      published_at,
    };
  });
}

export const opportunitiesAdapter: Adapter = {
  section: "opportunities",
  sources: ["LinkedIn"],
  async collect(opts: CollectOpts): Promise<RadarItem[]> {
    return collectLinkedIn(opts); // SerpAPI branch added in Task A4
  },
};
```
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Register** in `collect.ts`: `import { opportunitiesAdapter } from "./adapters/opportunities.js";` and set `opportunities: opportunitiesAdapter` in `ADAPTERS`.
- [ ] **Step 6: Run full suite → PASS;** `tsc --noEmit` clean. **Commit** `feat(mcp): opportunities adapter via LinkedIn (ported, fetcher-injected)`.

---

### Task A4: `opportunities` SerpAPI opt-in path

**Files:** Modify `packages/mcp-server/src/adapters/opportunities.ts`, `opportunities.test.ts`.

**Port note:** from `D:\github_repository\server-google-jobs\src\index.ts`, reuse the SerpAPI URL params (`engine=google_jobs`, `q`, `location?`, `chips=date_posted:…`, `hl?`) and the `jobs_results[]` field names (`title`, `company_name`, `location`, `detected_extensions.posted_at`, `description`, `apply_options[0].link`).

- [ ] **Step 1: Failing test** — add a SerpAPI-path test that sets the env, injects a JSON fixture, and asserts the mapped item; restore env after:
```ts
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
```
- [ ] **Step 2: Run → FAIL** (still hits LinkedIn path / wrong source).
- [ ] **Step 3: Implement** a `collectSerpApi(opts)` (build `https://serpapi.com/search?engine=google_jobs&q=…&api_key=…`, `JSON.parse(await fetcher(url))`, map `jobs_results` → `RadarItem` with `source: "Google Jobs"`, `url = apply_options[0].link`, `summary` from company+location+description, `published_at` best-effort from `posted_at` relative-time → fallback `now`). In `collect()`: `return process.env.SERP_API_KEY ? collectSerpApi(opts) : collectLinkedIn(opts);`
- [ ] **Step 4: Run → PASS** (both the LinkedIn default test and the SerpAPI test). **Commit** `feat(mcp): opt-in SerpAPI Google Jobs path for opportunities (env-gated)`.

---

### Task A5: `discussions` adapter — Hacker News Algolia (free)

**Files:**
- Create: `packages/mcp-server/src/adapters/discussions.ts`, `discussions.test.ts`
- Modify: `packages/mcp-server/src/collect.ts` (register)

**Interfaces:** Produces `discussionsAdapter: Adapter` (`section: "discussions"`, `sources: ["Hacker News"]`).

- [ ] **Step 1: Failing test** — JSON fixture from the HN Algolia shape:
```ts
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
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** `discussions.ts`:
```ts
import type { RadarItem } from "../schema.js";
import { scoreItem } from "../score.js";
import { hashId } from "./utils.js";
import type { Adapter, CollectOpts } from "./types.js";

const HN = "https://hn.algolia.com/api/v1/search_by_date";
const HN_QUERY = 'femtech OR "women\'s health" OR "women in tech"';

export const discussionsAdapter: Adapter = {
  section: "discussions",
  sources: ["Hacker News"],
  async collect({ limit, now, fetcher, keywords }: CollectOpts): Promise<RadarItem[]> {
    const url = `${HN}?query=${encodeURIComponent(HN_QUERY)}&tags=story&hitsPerPage=${limit}`;
    const data = JSON.parse(await fetcher(url));
    const hits: any[] = Array.isArray(data?.hits) ? data.hits : [];
    return hits.slice(0, limit).map((h): RadarItem => {
      const itemUrl = h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`;
      const summary = `${h.points ?? 0} points · ${h.num_comments ?? 0} comments on Hacker News`;
      const published_at = String(h.created_at);
      return {
        id: hashId(itemUrl), section: "discussions", title: String(h.title ?? ""), url: itemUrl,
        source: "Hacker News", summary, published_at,
        score: scoreItem({ title: String(h.title ?? ""), summary, popularity: Number(h.points ?? 0), published_at, now, keywords }),
        raw_metrics: { points: Number(h.points ?? 0), comments: Number(h.num_comments ?? 0) },
      };
    });
  },
};
```
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Register** in `collect.ts`: `import { discussionsAdapter } from "./adapters/discussions.js";` and `discussions: discussionsAdapter`.
- [ ] **Step 6: Run full suite → PASS;** `tsc --noEmit` clean. **Commit** `feat(mcp): discussions adapter via Hacker News Algolia`.

---

### Task B1: Wire the weekly workflow to all 4 sections

**Files:** Modify `.github/workflows/weekly-radar.md`; regenerate `.github/workflows/weekly-radar.lock.yml`.

- [ ] **Step 1: Frontmatter** — extend `network.allowed` with `www.linkedin.com`, `hn.algolia.com`, `serpapi.com`. Keep `engine.model: gpt-4.1`.
- [ ] **Step 2: Prompt body** — change step 1 to call `radar_collect` for all four sections (`industry`, `research`, `opportunities`, `discussions`), each `limit: 12`; update the JSON-shape block so `opportunities` and `discussions` are populated arrays (each item carrying `why_it_matters`) rather than `[]`. Keep the "if a section returns warnings or no items, note it in editor_note" line (covers LinkedIn/HN being blocked).
- [ ] **Step 3: Document SerpAPI opt-in** — add an HTML comment in the `.md` explaining: to enable the SerpAPI Google Jobs path, add repo secret `SERP_API_KEY` and an `env: { SERP_API_KEY: "${{ secrets.SERP_API_KEY }}" }` block under the `femtech-radar` mcp-server. (Do not enable by default.)
- [ ] **Step 4: Compile** — `gh aw compile weekly-radar`; expect 0 errors.
- [ ] **Step 5: Verify lock** — `grep -E "linkedin|hn.algolia|opportunities|discussions" .github/workflows/weekly-radar.lock.yml` shows the new hosts and the 4-section prompt.
- [ ] **Step 6: Commit** both files: `feat(workflow): collect all four sections; allowlist linkedin + hacker news`.

---

### Task C1: Site DRY + safety helpers

**Files:** Create `site/src/lib/content.ts` (+ test); modify `site/src/lib/strip-html.ts`? no — modify the 5 page call sites, `RadarCard.astro`, `lib/rss.ts`, and remove the dead `Section` re-export in `lib/schema.ts`.

**Interfaces:** Produces `getWeeks(entries): WeeklyDataWithWhy[]` and `safeISODate(s: string): string` (`''` when invalid).

- [ ] **Step 1: Failing test** — `site/src/lib/content.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { safeISODate } from "./content";
describe("safeISODate", () => {
  test("formats a valid date to YYYY-MM-DD", () => { expect(safeISODate("2026-06-29T20:00:00Z")).toBe("2026-06-29"); });
  test("returns '' for an invalid date", () => { expect(safeISODate("not-a-date")).toBe(""); });
});
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** `site/src/lib/content.ts`:
```ts
import type { CollectionEntry } from "astro:content";
import type { WeeklyDataWithWhy } from "./schema";
export function getWeeks(entries: CollectionEntry<"radar">[]): WeeklyDataWithWhy[] {
  return entries.map((e) => e.data as WeeklyDataWithWhy);
}
export function safeISODate(s: string): string {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
```
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Refactor call sites** — in `index.astro`, `archive.astro`, `week/[week].astro`, `sources.astro`, `pages/rss.xml.ts`, replace `entries.map((e) => e.data as WeeklyDataWithWhy)` with `getWeeks(entries)` (import from `../lib/content` / `../../lib/content`). Replace the unguarded `new Date(x).toISOString().slice(0,10)` in `RadarCard.astro`, `index.astro`, `week/[week].astro` with `safeISODate(x)`. In `lib/rss.ts`, guard the `pubDate`: build `const d = new Date(it.published_at); ... pubDate: Number.isNaN(d.getTime()) ? undefined : d` (omit `pubDate` when invalid). Remove the unused `export { Section }` from `lib/schema.ts`.
- [ ] **Step 6: Verify** — `pnpm --filter femtech-radar-site exec astro check` clean; `pnpm --filter femtech-radar-site test` green; `build` succeeds. **Commit** `refactor(site): getWeeks + safeISODate helpers; drop dead Section export`.

---

### Task C2: Site polish — favicon, entity decode, sources chip, source snapshot

**Files:** Create `site/public/favicon.svg`; modify `site/src/layouts/BaseLayout.astro`, `site/src/lib/strip-html.ts` (+ test), `site/src/pages/sources.astro`, `site/src/styles/global.css`, `site/src/lib/sources.ts`.

- [ ] **Step 1: Failing test for numeric entity decode** — add to `site/src/lib/strip-html.test.ts`:
```ts
test("decodes decimal and hex numeric entities", () => {
  expect(stripHtml("Tom&#39;s &#x27;quote&#x27; &amp; more")).toBe("Tom's 'quote' & more");
});
```
- [ ] **Step 2: Run → FAIL** (hex `&#x27;` currently becomes a space).
- [ ] **Step 3: Implement** — in `strip-html.ts`, replace the entity step so numeric entities decode via `String.fromCodePoint`:
```ts
.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
.replace(/&\w+;/g, (m) => ENTITIES[m] ?? " ")
```
(keep the named-entity `ENTITIES` map and the tag-strip + whitespace-collapse steps). Run → PASS (and existing strip-html tests stay green).
- [ ] **Step 4: Favicon** — create `site/public/favicon.svg` (a simple warm-rose radar mark) and add to `BaseLayout.astro` `<head>`: `<link rel="icon" type="image/svg+xml" href={withBase('/favicon.svg')} />`.
- [ ] **Step 5: Sources chip** — in `sources.astro` change the section chip `class="score"` → `class="tag"`; add a `.tag { ... }` rule in `global.css` (reuse the `--rose-soft`/`--rose` tokens, pill shape). Update `lib/sources.ts` `CONFIGURED_SOURCES`: `opportunities` → `{ name: "LinkedIn", detail: "Women-in-tech / FemTech job postings (LinkedIn guest search).", status: "live" }`; `discussions` → `{ name: "Hacker News", detail: "FemTech / women-in-tech discussion (HN Algolia search).", status: "live" }`.
- [ ] **Step 6: Verify** — `astro check` clean; `build` emits `dist/favicon.svg`; `/sources` shows LinkedIn + Hacker News as live. **Commit** `feat(site): favicon, numeric-entity decode, sources chip + live source snapshot`.

---

### Task C3: Per-section RSS feeds

**Files:** Create `site/src/pages/rss/[section].xml.ts`; modify `site/src/layouts/BaseLayout.astro` (alternate links).

- [ ] **Step 1: Implement** `site/src/pages/rss/[section].xml.ts`:
```ts
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getCollection } from "astro:content";
import { getWeeks } from "../../lib/content";
import { toRssItems } from "../../lib/rss";
import { SECTION_KEYS } from "../../lib/schema";

export function getStaticPaths() {
  return SECTION_KEYS.map((section) => ({ params: { section } }));
}
export async function GET(context: APIContext) {
  const section = context.params.section as string;
  const weeks = getWeeks(await getCollection("radar"));
  const items = toRssItems(weeks).filter((i) => i.categories[0] === section);
  return rss({
    title: `FemTech Radar — ${section}`,
    description: `FemTech Radar ${section} feed.`,
    site: new URL(import.meta.env.BASE_URL, context.site ?? "https://chanmeng666.github.io").toString(),
    items: items.map((i) => ({ title: i.title, link: i.link, pubDate: i.pubDate, description: i.description, categories: i.categories })),
  });
}
```
- [ ] **Step 2: Alternate links** — in `BaseLayout.astro`, add per-section `<link rel="alternate" type="application/rss+xml" title={`FemTech Radar — ${s}`} href={withBase(`/rss/${s}.xml`)} />` for each `SECTION_KEYS` (import `SECTION_KEYS`).
- [ ] **Step 3: Verify** — `build` emits `dist/rss/industry.xml`, `research.xml`, `opportunities.xml`, `discussions.xml` (each well-formed; empty sections produce a valid empty channel). Confirm with: `for s in industry research opportunities discussions; do test -f site/dist/rss/$s.xml && echo "$s ok"; done`. **Commit** `feat(site): per-section RSS feeds`.

---

### Task D1: Documentation sync

**Files:** Modify `AGENTS.md`, `README.md`, `CHANGELOG.md`, `docs/superpowers/specs/2026-06-30-femtech-radar-design.md` (status note).

- [ ] **Step 1: AGENTS.md** — under Unit ①, document the two new adapters (`opportunities` → LinkedIn port, `discussions` → HN Algolia), the `gnews-url` decoder, the shared `utils.hashId`, the extended `Fetcher` (optional headers), and the SerpAPI opt-in (env `SERP_API_KEY`). Under Unit ②, note the expanded `network.allowed` and 4-section collection. Add the new source rows.
- [ ] **Step 2: README** — update Key Features / Architecture / Sources to reflect 4 live sections; credit the owner's `linkedin-jobs-api` / `linkedin-jobs-search` (LinkedIn port) and `server-google-jobs` (SerpAPI opt-in) under Tech Stack or a "Built on" note; mention per-section RSS.
- [ ] **Step 3: CHANGELOG** — add an Unreleased entry: opportunities (LinkedIn + opt-in SerpAPI) + discussions (HN) adapters, Google-News URL decode, per-section RSS, site polish, Fetcher header support.
- [ ] **Step 4: Spec** — add a short "Update (2026-07-01)" note in §6/§10 that opportunities + discussions now have adapters (LinkedIn / Hacker News), SerpAPI is an opt-in alternative.
- [ ] **Step 5: Commit** `docs: document 4-section sources, decoder, per-section RSS, SerpAPI opt-in`.

---

## Self-Review

**Spec coverage:** opportunities adapter (LinkedIn free + SerpAPI opt-in) → A3/A4; discussions adapter (HN) → A5; industry URL decode → A2; shared util + Fetcher headers → A1; workflow 4-section wiring → B1; site DRY/safety → C1; favicon/entity/chip/source-snapshot → C2; per-section RSS → C3; docs → D1. All confirmed decisions covered.

**Placeholder scan:** no TBD/TODO. The two large ports (A3 LinkedIn, A4 SerpAPI) name the exact source files and the precise functions/fields to port + the RadarItem mapping; everything else has complete code.

**Type consistency:** `Fetcher` gains an optional second arg (backward-compatible — existing adapters/tests calling `fetcher(url)` still typecheck). `hashId` single definition in `utils.ts` consumed by all adapters. `getWeeks`/`safeISODate` in `lib/content.ts` consumed by pages + rss. New adapters return `RadarItem[]` with `section` exactly `"opportunities"`/`"discussions"`.

**Known soft spots (call out at execution):**
1. LinkedIn guest endpoint may 403/429 from GitHub Actions IPs even with a browser UA → graceful-degrades to `[]` + warning; the workflow notes it in `editor_note`. Acceptable per the approved design.
2. `decodeGoogleNewsURL` is best-effort: newer Google-News encodings may not decode without a network round-trip; the function returns the original URL unchanged on any failure (no regression). Tests cover both the decodable and the fallback paths.
3. SerpAPI path stays dormant unless `SERP_API_KEY` is set in the adapter's runtime env (and, in CI, passed through the workflow's mcp-server `env`).
