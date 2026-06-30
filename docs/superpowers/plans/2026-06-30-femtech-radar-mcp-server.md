# femtech-radar MCP Server Implementation Plan (v1, Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the standalone `@chanmeng666/femtech-radar-mcp` server that deterministically fetches, normalizes, dedupes, and scores FemTech items from two sources (industry news + research), exposed over MCP via two tools.

**Architecture:** A TypeScript MCP server (stdio) inside a pnpm monorepo. Source adapters return raw items; a shared pipeline normalizes → dedupes → scores → ranks. The MCP does only deterministic work (no editorial judgment). The Zod schema package defines `RadarItem` / `WeeklyData`, the shared contract that the later workflow and Astro site plans consume.

**Tech Stack:** Node 20+, TypeScript 5, pnpm workspaces, `@modelcontextprotocol/sdk`, Zod, `fast-xml-parser`, Vitest, tsup (build).

## Global Constraints

- Node **>= 20** (uses global `fetch`).
- Package name: `@chanmeng666/femtech-radar-mcp`. License: **MIT**.
- All network I/O goes through an injected `Fetcher` type (`(url: string) => Promise<string>`) so adapters are unit-testable with fixtures — **no test makes a real network call**.
- `Section` is exactly `"industry" | "research" | "opportunities" | "discussions"`. v1 implements only `industry` and `research`; the other two resolve to an empty array (not an error).
- Every exported function has an explicit return type. Strict TypeScript (`"strict": true`).
- Graceful degradation: any adapter that throws or times out yields `[]` and is recorded in a `warnings` list — a single source failure never throws out of `collect()`.
- ESM only (`"type": "module"`).

---

### Task 1: Monorepo + MCP package skeleton

**Files:**
- Create: `D:/github_repository/femtech-radar/package.json`
- Create: `D:/github_repository/femtech-radar/pnpm-workspace.yaml`
- Create: `D:/github_repository/femtech-radar/.gitignore`
- Create: `D:/github_repository/femtech-radar/LICENSE`
- Create: `D:/github_repository/femtech-radar/packages/mcp-server/package.json`
- Create: `D:/github_repository/femtech-radar/packages/mcp-server/tsconfig.json`
- Create: `D:/github_repository/femtech-radar/packages/mcp-server/vitest.config.ts`
- Create: `D:/github_repository/femtech-radar/packages/mcp-server/src/smoke.ts`
- Test: `D:/github_repository/femtech-radar/packages/mcp-server/src/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `pnpm --filter @chanmeng666/femtech-radar-mcp test` and `... build`.

- [ ] **Step 1: Write the failing test**

`packages/mcp-server/src/smoke.test.ts`:
```ts
import { expect, test } from "vitest";
import { ping } from "./smoke.js";

test("ping returns pong", () => {
  expect(ping()).toBe("pong");
});
```

- [ ] **Step 2: Create workspace + package config**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "site"
```

Root `package.json`:
```json
{
  "name": "femtech-radar",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build"
  }
}
```

`.gitignore`:
```
node_modules/
dist/
.astro/
*.log
```

`LICENSE`: MIT text, copyright `2026 Chan Meng`.

`packages/mcp-server/package.json`:
```json
{
  "name": "@chanmeng666/femtech-radar-mcp",
  "version": "0.1.0",
  "type": "module",
  "license": "MIT",
  "bin": { "femtech-radar-mcp": "dist/index.js" },
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "test": "vitest run",
    "dev": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "fast-xml-parser": "^4.4.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

`packages/mcp-server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src"]
}
```

`packages/mcp-server/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
```

- [ ] **Step 3: Write minimal implementation**

`packages/mcp-server/src/smoke.ts`:
```ts
export function ping(): string {
  return "pong";
}
```

- [ ] **Step 4: Install and run the test**

Run:
```bash
cd D:/github_repository/femtech-radar && pnpm install && pnpm --filter @chanmeng666/femtech-radar-mcp test
```
Expected: 1 passing test.

- [ ] **Step 5: Verify build works**

Run: `pnpm --filter @chanmeng666/femtech-radar-mcp build`
Expected: `dist/index.js` is produced (after Task 8 adds `index.ts`; for now expect tsup to error on missing entry — acceptable, build is wired in Task 8). Skip build assertion here.

- [ ] **Step 6: Commit**

```bash
git add . && git commit -m "chore: scaffold monorepo and mcp-server package"
```

---

### Task 2: Shared schema (`RadarItem`, `WeeklyData`, `Section`)

**Files:**
- Create: `packages/mcp-server/src/schema.ts`
- Test: `packages/mcp-server/src/schema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `Section` = `z.enum(["industry","research","opportunities","discussions"])`; type `Section`.
  - `RadarItemSchema` (Zod) and type `RadarItem` with fields: `id: string`, `section: Section`, `title: string`, `url: string`, `source: string`, `summary: string`, `score: number`, `published_at: string`, `raw_metrics?: { points?: number; comments?: number; citations?: number }`.
  - `WeeklyDataSchema` and type `WeeklyData` with: `week: string`, `generated_at: string`, `editor_note: string`, `sections: Record<Section, RadarItem[]>`.

- [ ] **Step 1: Write the failing test**

`packages/mcp-server/src/schema.test.ts`:
```ts
import { expect, test } from "vitest";
import { RadarItemSchema, WeeklyDataSchema } from "./schema.js";

const item = {
  id: "abc", section: "research", title: "A study",
  url: "https://x.test/a", source: "arXiv", summary: "...",
  score: 42, published_at: "2026-06-30T00:00:00Z",
};

test("RadarItemSchema accepts a valid item", () => {
  expect(RadarItemSchema.parse(item)).toMatchObject({ id: "abc", score: 42 });
});

test("RadarItemSchema rejects an out-of-range score", () => {
  expect(() => RadarItemSchema.parse({ ...item, score: 101 })).toThrow();
});

test("WeeklyDataSchema requires all four sections", () => {
  const wd = {
    week: "2026-W27", generated_at: "2026-06-30T00:00:00Z", editor_note: "hi",
    sections: { industry: [], research: [item], opportunities: [], discussions: [] },
  };
  expect(WeeklyDataSchema.parse(wd).sections.research).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chanmeng666/femtech-radar-mcp test src/schema.test.ts`
Expected: FAIL — `./schema.js` not found.

- [ ] **Step 3: Write minimal implementation**

`packages/mcp-server/src/schema.ts`:
```ts
import { z } from "zod";

export const Section = z.enum(["industry", "research", "opportunities", "discussions"]);
export type Section = z.infer<typeof Section>;

export const RadarItemSchema = z.object({
  id: z.string(),
  section: Section,
  title: z.string(),
  url: z.string().url(),
  source: z.string(),
  summary: z.string(),
  score: z.number().min(0).max(100),
  published_at: z.string(),
  raw_metrics: z
    .object({ points: z.number().optional(), comments: z.number().optional(), citations: z.number().optional() })
    .optional(),
});
export type RadarItem = z.infer<typeof RadarItemSchema>;

export const WeeklyDataSchema = z.object({
  week: z.string(),
  generated_at: z.string(),
  editor_note: z.string(),
  sections: z.object({
    industry: z.array(RadarItemSchema),
    research: z.array(RadarItemSchema),
    opportunities: z.array(RadarItemSchema),
    discussions: z.array(RadarItemSchema),
  }),
});
export type WeeklyData = z.infer<typeof WeeklyDataSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chanmeng666/femtech-radar-mcp test src/schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/schema.ts packages/mcp-server/src/schema.test.ts
git commit -m "feat(mcp): add RadarItem and WeeklyData schema"
```

---

### Task 3: URL canonicalization + dedup

**Files:**
- Create: `packages/mcp-server/src/dedup.ts`
- Test: `packages/mcp-server/src/dedup.test.ts`

**Interfaces:**
- Consumes: `RadarItem` from `./schema.js`.
- Produces:
  - `canonicalUrl(url: string): string` — lowercases host, drops `utm_*`/`fbclid` params, strips fragment and trailing slash.
  - `titleTokens(title: string): Set<string>` — lowercased word set.
  - `jaccard(a: Set<string>, b: Set<string>): number`.
  - `dedupe(items: RadarItem[], threshold?: number): RadarItem[]` — removes items sharing a canonical URL or whose title Jaccard ≥ threshold (default 0.8); on collision keeps the higher `score`.

- [ ] **Step 1: Write the failing test**

`packages/mcp-server/src/dedup.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chanmeng666/femtech-radar-mcp test src/dedup.test.ts`
Expected: FAIL — `./dedup.js` not found.

- [ ] **Step 3: Write minimal implementation**

`packages/mcp-server/src/dedup.ts`:
```ts
import type { RadarItem } from "./schema.js";

export function canonicalUrl(url: string): string {
  const u = new URL(url);
  u.hostname = u.hostname.toLowerCase();
  u.hash = "";
  for (const k of [...u.searchParams.keys()]) {
    if (k.toLowerCase().startsWith("utm_") || k.toLowerCase() === "fbclid") u.searchParams.delete(k);
  }
  let s = u.toString();
  s = s.replace(/\/(\?|$)/, "$1").replace(/\?$/, "");
  return s;
}

export function titleTokens(title: string): Set<string> {
  return new Set(title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export function dedupe(items: RadarItem[], threshold = 0.8): RadarItem[] {
  const kept: { item: RadarItem; url: string; tokens: Set<string> }[] = [];
  for (const item of [...items].sort((x, y) => y.score - x.score)) {
    const url = canonicalUrl(item.url);
    const tokens = titleTokens(item.title);
    const dup = kept.find((k) => k.url === url || jaccard(k.tokens, tokens) >= threshold);
    if (!dup) kept.push({ item, url, tokens });
  }
  return kept.map((k) => k.item);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chanmeng666/femtech-radar-mcp test src/dedup.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/dedup.ts packages/mcp-server/src/dedup.test.ts
git commit -m "feat(mcp): add url canonicalization and dedupe"
```

---

### Task 4: Relevance/popularity/freshness scoring

**Files:**
- Create: `packages/mcp-server/src/score.ts`
- Test: `packages/mcp-server/src/score.test.ts`

**Interfaces:**
- Consumes: nothing (operates on plain fields).
- Produces:
  - `FEMTECH_KEYWORDS: string[]` — default relevance vocabulary.
  - `scoreItem(input: { title: string; summary: string; popularity: number; published_at: string; now: Date; keywords?: string[] }): number` — returns 0–100. Formula below; deterministic given `now`.

- [ ] **Step 1: Write the failing test**

`packages/mcp-server/src/score.test.ts`:
```ts
import { expect, test } from "vitest";
import { scoreItem } from "./score.js";

const now = new Date("2026-06-30T00:00:00Z");

test("fresh, on-topic, popular item scores higher than stale off-topic one", () => {
  const hot = scoreItem({
    title: "FemTech maternal health AI startup", summary: "women's health funding",
    popularity: 500, published_at: "2026-06-29T00:00:00Z", now,
  });
  const cold = scoreItem({
    title: "Generic database benchmark", summary: "unrelated",
    popularity: 1, published_at: "2026-01-01T00:00:00Z", now,
  });
  expect(hot).toBeGreaterThan(cold);
  expect(hot).toBeLessThanOrEqual(100);
  expect(cold).toBeGreaterThanOrEqual(0);
});

test("score is deterministic", () => {
  const args = { title: "femtech", summary: "", popularity: 10, published_at: "2026-06-28T00:00:00Z", now };
  expect(scoreItem(args)).toBe(scoreItem(args));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chanmeng666/femtech-radar-mcp test src/score.test.ts`
Expected: FAIL — `./score.js` not found.

- [ ] **Step 3: Write minimal implementation**

`packages/mcp-server/src/score.ts`:
```ts
export const FEMTECH_KEYWORDS: string[] = [
  "femtech", "women's health", "womens health", "maternal", "fertility",
  "reproductive", "menopause", "menstrual", "pregnancy", "gynecology",
  "women in tech", "diversity", "girls who code",
];

function relevance(text: string, keywords: string[]): number {
  const hay = text.toLowerCase();
  let hits = 0;
  for (const k of keywords) if (hay.includes(k)) hits++;
  return Math.min(1, hits / 3); // 3+ keyword hits saturates relevance
}

function popularityScore(popularity: number): number {
  return Math.min(1, Math.log10(Math.max(1, popularity) + 1) / 3); // ~1000 saturates
}

function freshness(published_at: string, now: Date): number {
  const ageDays = (now.getTime() - new Date(published_at).getTime()) / 86_400_000;
  if (Number.isNaN(ageDays)) return 0;
  return Math.max(0, 1 - ageDays / 30); // linear decay over 30 days
}

export function scoreItem(input: {
  title: string; summary: string; popularity: number;
  published_at: string; now: Date; keywords?: string[];
}): number {
  const kw = input.keywords ?? FEMTECH_KEYWORDS;
  const rel = relevance(`${input.title} ${input.summary}`, kw);
  const pop = popularityScore(input.popularity);
  const fresh = freshness(input.published_at, input.now);
  const raw = 0.5 * rel + 0.3 * pop + 0.2 * fresh; // weights sum to 1
  return Math.round(raw * 100);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chanmeng666/femtech-radar-mcp test src/score.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/score.ts packages/mcp-server/src/score.test.ts
git commit -m "feat(mcp): add relevance/popularity/freshness scoring"
```

---

### Task 5: Adapter contract + research (arXiv) adapter

**Files:**
- Create: `packages/mcp-server/src/adapters/types.ts`
- Create: `packages/mcp-server/src/adapters/research.ts`
- Test: `packages/mcp-server/src/adapters/research.test.ts`

**Interfaces:**
- Consumes: `RadarItem` (`../schema.js`), `scoreItem` (`../score.js`).
- Produces:
  - `type Fetcher = (url: string) => Promise<string>`.
  - `interface CollectOpts { since: Date; limit: number; now: Date; fetcher: Fetcher; keywords?: string[] }`.
  - `interface Adapter { section: RadarItem["section"]; sources: string[]; collect(opts: CollectOpts): Promise<RadarItem[]> }`.
  - `researchAdapter: Adapter` — queries arXiv, parses Atom XML, returns scored `RadarItem[]` with `section: "research"`, `source: "arXiv"`.

- [ ] **Step 1: Write the failing test**

`packages/mcp-server/src/adapters/research.test.ts`:
```ts
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

test("research adapter returns [] when fetcher throws", async () => {
  const items = await researchAdapter.collect({
    since: new Date("2026-06-01T00:00:00Z"), limit: 10,
    now: new Date("2026-06-30T00:00:00Z"),
    fetcher: async () => { throw new Error("network"); },
  });
  expect(items).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chanmeng666/femtech-radar-mcp test src/adapters/research.test.ts`
Expected: FAIL — `./research.js` not found.

- [ ] **Step 3: Write minimal implementation**

`packages/mcp-server/src/adapters/types.ts`:
```ts
import type { RadarItem } from "../schema.js";

export type Fetcher = (url: string) => Promise<string>;

export interface CollectOpts {
  since: Date;
  limit: number;
  now: Date;
  fetcher: Fetcher;
  keywords?: string[];
}

export interface Adapter {
  section: RadarItem["section"];
  sources: string[];
  collect(opts: CollectOpts): Promise<RadarItem[]>;
}
```

`packages/mcp-server/src/adapters/research.ts`:
```ts
import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import type { RadarItem } from "../schema.js";
import { scoreItem } from "../score.js";
import type { Adapter, CollectOpts } from "./types.js";

const ARXIV = "http://export.arxiv.org/api/query";
const parser = new XMLParser();

function hashId(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

export const researchAdapter: Adapter = {
  section: "research",
  sources: ["arXiv"],
  async collect({ limit, now, fetcher, keywords }: CollectOpts): Promise<RadarItem[]> {
    const q = encodeURIComponent('all:femtech OR all:"women\'s health" OR all:maternal');
    const url = `${ARXIV}?search_query=${q}&sortBy=submittedDate&sortOrder=descending&max_results=${limit}`;
    try {
      const xml = await fetcher(url);
      const feed = parser.parse(xml)?.feed;
      const entries = feed?.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : [];
      return entries.map((e: Record<string, string>): RadarItem => {
        const itemUrl = String(e.id);
        const title = String(e.title).trim();
        const summary = String(e.summary ?? "").trim();
        const published_at = String(e.published);
        return {
          id: hashId(itemUrl), section: "research", title, url: itemUrl,
          source: "arXiv", summary, published_at,
          score: scoreItem({ title, summary, popularity: 0, published_at, now, keywords }),
        };
      });
    } catch {
      return [];
    }
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chanmeng666/femtech-radar-mcp test src/adapters/research.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/adapters/types.ts packages/mcp-server/src/adapters/research.ts packages/mcp-server/src/adapters/research.test.ts
git commit -m "feat(mcp): add adapter contract and arXiv research adapter"
```

---

### Task 6: Industry (Google News RSS) adapter

**Files:**
- Create: `packages/mcp-server/src/adapters/industry.ts`
- Test: `packages/mcp-server/src/adapters/industry.test.ts`

**Interfaces:**
- Consumes: `Adapter`, `CollectOpts` (`./types.js`), `scoreItem` (`../score.js`), `RadarItem`.
- Produces: `industryAdapter: Adapter` — fetches Google News RSS, parses `rss.channel.item[]`, returns scored `RadarItem[]` with `section: "industry"`, `source: "Google News"`.

- [ ] **Step 1: Write the failing test**

`packages/mcp-server/src/adapters/industry.test.ts`:
```ts
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

test("industry adapter returns [] when fetcher throws", async () => {
  const items = await industryAdapter.collect({
    since: new Date("2026-06-01T00:00:00Z"), limit: 10,
    now: new Date("2026-06-30T00:00:00Z"),
    fetcher: async () => { throw new Error("network"); },
  });
  expect(items).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chanmeng666/femtech-radar-mcp test src/adapters/industry.test.ts`
Expected: FAIL — `./industry.js` not found.

- [ ] **Step 3: Write minimal implementation**

`packages/mcp-server/src/adapters/industry.ts`:
```ts
import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import type { RadarItem } from "../schema.js";
import { scoreItem } from "../score.js";
import type { Adapter, CollectOpts } from "./types.js";

const GOOGLE_NEWS = "https://news.google.com/rss/search";
const parser = new XMLParser();

function hashId(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

export const industryAdapter: Adapter = {
  section: "industry",
  sources: ["Google News"],
  async collect({ limit, now, fetcher, keywords }: CollectOpts): Promise<RadarItem[]> {
    const url = `${GOOGLE_NEWS}?q=${encodeURIComponent("femtech OR \"women's health\"")}&hl=en-US`;
    try {
      const xml = await fetcher(url);
      const ch = parser.parse(xml)?.rss?.channel;
      const items = ch?.item ? (Array.isArray(ch.item) ? ch.item : [ch.item]) : [];
      return items.slice(0, limit).map((e: Record<string, string>): RadarItem => {
        const itemUrl = String(e.link);
        const title = String(e.title).trim();
        const summary = String(e.description ?? "").trim();
        const published_at = new Date(String(e.pubDate)).toISOString();
        return {
          id: hashId(itemUrl), section: "industry", title, url: itemUrl,
          source: "Google News", summary, published_at,
          score: scoreItem({ title, summary, popularity: 0, published_at, now, keywords }),
        };
      });
    } catch {
      return [];
    }
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chanmeng666/femtech-radar-mcp test src/adapters/industry.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/adapters/industry.ts packages/mcp-server/src/adapters/industry.test.ts
git commit -m "feat(mcp): add Google News industry adapter"
```

---

### Task 7: `collect()` orchestration + real HTTP fetcher

**Files:**
- Create: `packages/mcp-server/src/collect.ts`
- Test: `packages/mcp-server/src/collect.test.ts`

**Interfaces:**
- Consumes: `industryAdapter`, `researchAdapter`, `dedupe`, `Section`, `RadarItem`, `Fetcher`.
- Produces:
  - `httpFetcher: Fetcher` — real `fetch`-based fetcher with a 10s timeout.
  - `ADAPTERS: Record<Section, Adapter | null>` — `opportunities`/`discussions` are `null` in v1.
  - `collect(args: { section: Section; since: Date; limit: number; now: Date; fetcher?: Fetcher; keywords?: string[] }): Promise<{ items: RadarItem[]; warnings: string[] }>` — runs the adapter, dedupes, sorts by score desc, truncates to `limit`. Unknown/null section → `{ items: [], warnings: ["no adapter for <section>"] }`.

- [ ] **Step 1: Write the failing test**

`packages/mcp-server/src/collect.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chanmeng666/femtech-radar-mcp test src/collect.test.ts`
Expected: FAIL — `./collect.js` not found.

- [ ] **Step 3: Write minimal implementation**

`packages/mcp-server/src/collect.ts`:
```ts
import type { RadarItem, Section } from "./schema.js";
import { dedupe } from "./dedup.js";
import type { Adapter, Fetcher } from "./adapters/types.js";
import { industryAdapter } from "./adapters/industry.js";
import { researchAdapter } from "./adapters/research.js";

export const httpFetcher: Fetcher = async (url: string): Promise<string> => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "femtech-radar" } });
    return await res.text();
  } finally {
    clearTimeout(t);
  }
};

export const ADAPTERS: Record<Section, Adapter | null> = {
  industry: industryAdapter,
  research: researchAdapter,
  opportunities: null,
  discussions: null,
};

export async function collect(args: {
  section: Section; since: Date; limit: number; now: Date;
  fetcher?: Fetcher; keywords?: string[];
}): Promise<{ items: RadarItem[]; warnings: string[] }> {
  const adapter = ADAPTERS[args.section];
  if (!adapter) return { items: [], warnings: [`no adapter for ${args.section}`] };
  const fetcher = args.fetcher ?? httpFetcher;
  const warnings: string[] = [];
  let raw: RadarItem[] = [];
  try {
    raw = await adapter.collect({ since: args.since, limit: args.limit, now: args.now, fetcher, keywords: args.keywords });
  } catch (err) {
    warnings.push(`${args.section} adapter failed: ${(err as Error).message}`);
  }
  const items = dedupe(raw).sort((a, b) => b.score - a.score).slice(0, args.limit);
  return { items, warnings };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chanmeng666/femtech-radar-mcp test src/collect.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/collect.ts packages/mcp-server/src/collect.test.ts
git commit -m "feat(mcp): add collect orchestration and http fetcher"
```

---

### Task 8: MCP tools + server entry (`radar_collect`, `radar_sources`)

**Files:**
- Create: `packages/mcp-server/src/tools.ts`
- Create: `packages/mcp-server/src/index.ts`
- Test: `packages/mcp-server/src/tools.test.ts`

**Interfaces:**
- Consumes: `collect`, `ADAPTERS`, `Section`.
- Produces:
  - `handleCollect(input: { section: string; since?: string; limit?: number }, now?: Date): Promise<{ items: RadarItem[]; warnings: string[] }>` — validates `section`, defaults `since` to 7 days before `now`, `limit` to 15.
  - `handleSources(): { section: Section; sources: string[] }[]`.
  - `index.ts` registers both as MCP tools and starts a stdio server (smoke-tested for construction, not protocol I/O).

- [ ] **Step 1: Write the failing test**

`packages/mcp-server/src/tools.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chanmeng666/femtech-radar-mcp test src/tools.test.ts`
Expected: FAIL — `./tools.js` not found.

- [ ] **Step 3: Write minimal implementation**

`packages/mcp-server/src/tools.ts`:
```ts
import type { RadarItem, Section } from "./schema.js";
import { Section as SectionEnum } from "./schema.js";
import { collect, ADAPTERS } from "./collect.js";
import type { Fetcher } from "./adapters/types.js";

export async function handleCollect(
  input: { section: string; since?: string; limit?: number; fetcher?: Fetcher },
  now: Date = new Date(),
): Promise<{ items: RadarItem[]; warnings: string[] }> {
  const section = SectionEnum.parse(input.section) as Section;
  const since = input.since ? new Date(input.since) : new Date(now.getTime() - 7 * 86_400_000);
  const limit = input.limit ?? 15;
  return collect({ section, since, limit, now, fetcher: input.fetcher });
}

export function handleSources(): { section: Section; sources: string[] }[] {
  return (Object.keys(ADAPTERS) as Section[]).map((section) => ({
    section,
    sources: ADAPTERS[section]?.sources ?? [],
  }));
}
```

`packages/mcp-server/src/index.ts`:
```ts
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleCollect, handleSources } from "./tools.js";

const server = new McpServer({ name: "femtech-radar", version: "0.1.0" });

server.tool(
  "radar_collect",
  { section: z.string(), since: z.string().optional(), limit: z.number().optional() },
  async (args) => {
    const out = await handleCollect(args);
    return { content: [{ type: "text", text: JSON.stringify(out) }] };
  },
);

server.tool("radar_sources", {}, async () => ({
  content: [{ type: "text", text: JSON.stringify(handleSources()) }],
}));

await server.connect(new StdioServerTransport());
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chanmeng666/femtech-radar-mcp test src/tools.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify the whole suite + build**

Run:
```bash
pnpm --filter @chanmeng666/femtech-radar-mcp test && pnpm --filter @chanmeng666/femtech-radar-mcp build
```
Expected: all tests pass; `dist/index.js` produced.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-server/src/tools.ts packages/mcp-server/src/index.ts packages/mcp-server/src/tools.test.ts
git commit -m "feat(mcp): add radar_collect and radar_sources tools and stdio server"
```

---

### Task 9: npx smoke test + package README

**Files:**
- Create: `packages/mcp-server/README.md`
- Modify: `packages/mcp-server/package.json` (add `description`, `repository`, `keywords`)

**Interfaces:**
- Consumes: built `dist/index.js`.
- Produces: a runnable binary; documented `mcp.json` snippet for gh aw / Claude Desktop.

- [ ] **Step 1: Build and smoke-run the server over stdio**

Run:
```bash
pnpm --filter @chanmeng666/femtech-radar-mcp build
printf '{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n' | node packages/mcp-server/dist/index.js
```
Expected: a JSON-RPC response listing `radar_collect` and `radar_sources` (server may stay open; Ctrl-C to exit).

- [ ] **Step 2: Write the package README**

`packages/mcp-server/README.md` documenting: install (`npx @chanmeng666/femtech-radar-mcp`), the two tools and their params, and the gh aw `mcp-servers` config snippet:
```yaml
mcp-servers:
  femtech-radar:
    command: npx
    args: ["-y", "@chanmeng666/femtech-radar-mcp"]
```

- [ ] **Step 3: Add package metadata**

Add to `packages/mcp-server/package.json`:
```json
"description": "MCP server that fetches, dedupes, and scores FemTech industry & research items.",
"keywords": ["mcp", "femtech", "model-context-protocol", "arxiv", "news"],
"repository": { "type": "git", "url": "https://github.com/ChanMeng666/femtech-radar" }
```

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-server/README.md packages/mcp-server/package.json
git commit -m "docs(mcp): add package readme and metadata"
```

---

## Self-Review

**Spec coverage (Unit ① of the spec):**
- RadarItem schema → Task 2 ✓
- industry + research adapters (v1 scope) → Tasks 5, 6 ✓
- fetch → normalize → dedup → score pipeline → Tasks 3, 4, 5, 6, 7 ✓
- graceful degradation → Tasks 5/6 (`catch → []`) + Task 7 (warnings) ✓
- `radar_collect` / `radar_sources` tools → Task 8 ✓
- npm-publishable, npx-runnable → Tasks 1, 9 ✓
- Vitest, no real network calls → all adapter tests use injected fetcher ✓
- `WeeklyData` schema (shared contract for later plans) → Task 2 ✓ (consumed by the workflow + site plans)
- Deferred to Plans 2 & 3: gh aw workflow (Unit ②), Astro site + RSS (Unit ③). Not in this plan by design.

**Placeholder scan:** No TBD/TODO; every code step shows full code; every run step shows the command and expected result. ✓

**Type consistency:** `Fetcher`, `CollectOpts`, `Adapter` defined in Task 5 and reused verbatim in Tasks 6–8. `collect()` signature in Task 7 matches its caller `handleCollect` in Task 8. `Section` enum from Task 2 used consistently. `scoreItem` signature from Task 4 matches calls in Tasks 5/6. ✓

**Note:** Test paths like `test src/foo.test.ts` pass a filter to `vitest run`; if your pnpm version needs it, use `pnpm --filter @chanmeng666/femtech-radar-mcp exec vitest run src/foo.test.ts`.
