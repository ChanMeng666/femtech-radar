# femtech-radar Astro + RSS Site Implementation Plan (v1, Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a content-first, subscribable Astro static site (`site/`) that reads the repo-root `data/*.json` weekly digests, renders home / archive / single-week / sources pages plus an RSS feed, and auto-deploys to GitHub Pages on `data/**` changes.

**Architecture:** Astro 5 static site in the existing pnpm monorepo. Weekly JSON is loaded in-place from `../data` via Astro's content-layer `glob()` loader, validated against a schema that **reuses** `RadarItemSchema` from `@chanmeng666/femtech-radar-mcp/schema` (extended to keep the agent-added `why_it_matters`). All page logic that can be is extracted to pure, unit-tested modules in `site/src/lib/`. A standalone GitHub Actions workflow (`deploy-pages.yml`) builds and deploys to Pages, decoupled from the `gh aw` weekly workflow. This is Unit ③ of the design spec; Units ① (MCP) and ② (workflow) are on `master`.

**Tech Stack:** Astro 5, `@astrojs/rss`, `@astrojs/check`, TypeScript (strict), Zod (reused `RadarItemSchema`), `@fontsource/fraunces` + `@fontsource/inter` (self-hosted), Vitest, GitHub Actions + Pages, Node ≥ 20, pnpm.

## Global Constraints

- The repo MUST stay **public** (free Actions + Pages; the design's cost model depends on it).
- Deploy target is the **GitHub Pages project sub-path**: `astro.config.mjs` MUST set `site: 'https://chanmeng666.github.io'` and `base: '/femtech-radar'`. Every internal link/asset MUST respect `base`.
- **Reuse, do not redefine, the data contract.** Import `RadarItemSchema` / `Section` from the side-effect-free subpath `@chanmeng666/femtech-radar-mcp/schema`. Importing the package **root** boots the stdio MCP server — never import it.
- `WeeklyDataSchema` is **non-strict**, so `.parse()` silently DROPS `why_it_matters`. The site MUST validate with an **extended** schema that keeps it. A contract test guards this.
- `RadarItem.summary` contains raw HTML for Google News items and plain text for arXiv. Strip HTML to plain text before rendering; never render it as raw HTML.
- The site reads ONLY `data/` — no runtime API calls (pure static).
- Site code uses Vite/bundler module resolution: **extensionless** TS imports (do NOT carry the mcp-server's NodeNext `.js`-suffix rule into `site/`).
- The site package name is **`femtech-radar-site`** (used in all `pnpm --filter` commands).
- `data/YYYY-Www.json` week keys are ISO weeks and sort lexically (`2026-W27` > `2026-W26`).
- `site` is already declared in `pnpm-workspace.yaml`; `.gitignore` already ignores `.astro/` and `dist/`.
- Follow Conventional Commits.

## Prerequisites (Task 0 — controller, already satisfied this session)

- `data/2026-W27.json` is on `master` (PR #6 merged). Local `master` fast-forwarded to `origin/master`.
- Work happens on branch **`feat/v3-astro-site`** (branched off the updated `master`). Never commit to `master`.
- The mcp package is built (`packages/mcp-server/dist/schema.js` + `schema.d.ts` exist). If missing, run `pnpm --filter @chanmeng666/femtech-radar-mcp build` before site work.
- Seed the Plan 3 section in `.superpowers/sdd/progress.md`.

## File Structure

```
site/
├── package.json              # name: femtech-radar-site; astro, rss, fonts, vitest
├── astro.config.mjs          # site + base
├── tsconfig.json             # extends astro/tsconfigs/strict
├── vitest.config.ts          # unit tests for src/lib
├── src/
│   ├── content.config.ts     # radar collection: glob ../data + extended schema
│   ├── env.d.ts              # astro client types
│   ├── lib/
│   │   ├── schema.ts         # RadarItemWithWhySchema, WeeklyDataWithWhySchema, SECTION_KEYS
│   │   ├── schema.test.ts
│   │   ├── weeks.ts          # sortWeeksDesc, latestWeek, getWeek
│   │   ├── weeks.test.ts
│   │   ├── strip-html.ts     # stripHtml, truncate
│   │   ├── strip-html.test.ts
│   │   ├── with-base.ts      # joinBase (pure), withBase
│   │   ├── with-base.test.ts
│   │   ├── rss.ts            # toRssItems
│   │   ├── rss.test.ts
│   │   └── sources.ts        # static configured-source snapshot
│   ├── styles/global.css     # warm-magazine tokens + base styles
│   ├── layouts/BaseLayout.astro
│   ├── components/
│   │   ├── RadarCard.astro
│   │   └── SectionBlock.astro
│   └── pages/
│       ├── index.astro       # latest week
│       ├── archive.astro     # all weeks desc
│       ├── sources.astro     # transparency
│       ├── week/[week].astro # single issue
│       └── rss.xml.ts        # RSS feed
└── public/                   # favicon etc.
.github/workflows/deploy-pages.yml   # build + deploy to Pages
.github/workflows/ci.yml             # MODIFY: add site check/build/test
README.md                            # MODIFY: Live Demo link
AGENTS.md                            # MODIFY: site commands + scope
```

---

### Task 1: Scaffold the Astro site in `site/`

**Files:**
- Create: `site/package.json`, `site/astro.config.mjs`, `site/tsconfig.json`, `site/vitest.config.ts`, `site/src/env.d.ts`, `site/src/pages/index.astro` (placeholder)

**Interfaces:**
- Consumes: nothing (entry point of this plan).
- Produces: a buildable Astro workspace package named `femtech-radar-site`.

- [ ] **Step 1: Create `site/package.json`**

```json
{
  "name": "femtech-radar-site",
  "type": "module",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run"
  },
  "dependencies": {
    "@astrojs/rss": "^4.0.11",
    "@chanmeng666/femtech-radar-mcp": "workspace:*",
    "@fontsource/fraunces": "^5.1.0",
    "@fontsource/inter": "^5.1.0",
    "astro": "^5.6.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.4",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `site/astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://chanmeng666.github.io',
  base: '/femtech-radar',
});
```

- [ ] **Step 3: Create `site/tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

- [ ] **Step 4: Create `site/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Create `site/src/env.d.ts`**

```ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
```

- [ ] **Step 6: Create a placeholder `site/src/pages/index.astro`**

```astro
---
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FemTech Radar</title>
  </head>
  <body>
    <h1>FemTech Radar</h1>
  </body>
</html>
```

- [ ] **Step 7: Install and build**

Run (from repo root):
```bash
pnpm install
pnpm --filter @chanmeng666/femtech-radar-mcp build
pnpm --filter femtech-radar-site build
```
Expected: install succeeds; site build prints "Complete!" and creates `site/dist/femtech-radar/index.html` (note the `base` sub-path in the output directory layout) or `site/dist/index.html` depending on Astro's emit — confirm an `index.html` exists under `site/dist`.

- [ ] **Step 8: Commit**

```bash
git add site/package.json site/astro.config.mjs site/tsconfig.json site/vitest.config.ts site/src/env.d.ts site/src/pages/index.astro pnpm-lock.yaml
git commit -m "feat(site): scaffold Astro site (sub-path base, vitest, fonts)"
```

---

### Task 2: Data layer — reused/extended schema, content collection, week helpers

**Files:**
- Create: `site/src/lib/schema.ts`, `site/src/lib/schema.test.ts`, `site/src/content.config.ts`, `site/src/lib/weeks.ts`, `site/src/lib/weeks.test.ts`

**Interfaces:**
- Consumes: `RadarItemSchema`, `Section` from `@chanmeng666/femtech-radar-mcp/schema`.
- Produces:
  - `WeeklyDataWithWhySchema` (Zod) and type `WeeklyDataWithWhy`
  - `RadarItemWithWhySchema`, type `RadarItemWithWhy`
  - `SECTION_KEYS: readonly ['industry','research','opportunities','discussions']`, type `SectionKey`
  - `sortWeeksDesc(weeks: WeeklyDataWithWhy[]): WeeklyDataWithWhy[]`
  - `latestWeek(weeks: WeeklyDataWithWhy[]): WeeklyDataWithWhy | undefined`
  - `getWeek(weeks: WeeklyDataWithWhy[], key: string): WeeklyDataWithWhy | undefined`
  - a `radar` content collection (entries' `data` is `WeeklyDataWithWhy`)

- [ ] **Step 1: Write the failing schema test**

`site/src/lib/schema.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { WeeklyDataWithWhySchema } from './schema';

const validItem = {
  id: 'abc123',
  section: 'research',
  title: 'A paper',
  url: 'http://arxiv.org/abs/2606.29467v1',
  source: 'arXiv',
  summary: 'An abstract.',
  score: 55,
  published_at: '2026-06-28T15:51:53Z',
  why_it_matters: 'It matters because reasons.',
};
const valid = {
  week: '2026-W27',
  generated_at: '2026-06-30T00:00:00Z',
  editor_note: 'hi',
  sections: { industry: [], research: [validItem], opportunities: [], discussions: [] },
};

describe('WeeklyDataWithWhySchema', () => {
  test('keeps why_it_matters after parsing (guards the strip bug)', () => {
    const parsed = WeeklyDataWithWhySchema.parse(valid);
    expect(parsed.sections.research[0].why_it_matters).toBe('It matters because reasons.');
  });

  test('rejects an object missing a section', () => {
    const bad = { ...valid, sections: { industry: [], research: [] } };
    expect(() => WeeklyDataWithWhySchema.parse(bad)).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter femtech-radar-site exec vitest run src/lib/schema.test.ts`
Expected: FAIL — `./schema` not found / has no export.

- [ ] **Step 3: Write `site/src/lib/schema.ts`**

```ts
import { z } from 'zod';
import { RadarItemSchema, Section } from '@chanmeng666/femtech-radar-mcp/schema';

export const RadarItemWithWhySchema = RadarItemSchema.extend({
  why_it_matters: z.string().optional(),
});
export type RadarItemWithWhy = z.infer<typeof RadarItemWithWhySchema>;

export const WeeklyDataWithWhySchema = z.object({
  week: z.string(),
  generated_at: z.string(),
  editor_note: z.string(),
  sections: z.object({
    industry: z.array(RadarItemWithWhySchema),
    research: z.array(RadarItemWithWhySchema),
    opportunities: z.array(RadarItemWithWhySchema),
    discussions: z.array(RadarItemWithWhySchema),
  }),
});
export type WeeklyDataWithWhy = z.infer<typeof WeeklyDataWithWhySchema>;

export const SECTION_KEYS = ['industry', 'research', 'opportunities', 'discussions'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export { Section };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter femtech-radar-site exec vitest run src/lib/schema.test.ts`
Expected: PASS (2 tests). If it errors on the `@chanmeng666/femtech-radar-mcp/schema` import, ensure the package is built (`pnpm --filter @chanmeng666/femtech-radar-mcp build`).

- [ ] **Step 5: Write the content collection `site/src/content.config.ts`**

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { WeeklyDataWithWhySchema } from './lib/schema';

const radar = defineCollection({
  loader: glob({ pattern: '**/*.json', base: '../data' }),
  schema: WeeklyDataWithWhySchema,
});

export const collections = { radar };
```

> **Gotcha / fallback:** `glob` reads files from anywhere on disk, so `base: '../data'` (repo-root `data/`) is expected to work. If `astro sync` / `astro check` rejects an out-of-`srcDir` base, fall back to a prebuild copy: add `"prebuild": "node -e \"import('node:fs').then(fs=>fs.cpSync('../data','src/content/radar',{recursive:true}))\""` to `site/package.json` and point the loader at `base: './src/content/radar'` (add `src/content/radar` to `.gitignore`). Decide empirically via Step 6.

- [ ] **Step 6: Verify the collection loads (via build)**

Run: `pnpm --filter femtech-radar-site build`
Expected: build succeeds (the collection is defined; the placeholder page still renders). If the loader errors on `../data`, apply the Step 5 fallback, then rebuild.

- [ ] **Step 7: Write the failing weeks-helper test**

`site/src/lib/weeks.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { getWeek, latestWeek, sortWeeksDesc } from './weeks';
import type { WeeklyDataWithWhy } from './schema';

const mk = (week: string): WeeklyDataWithWhy => ({
  week,
  generated_at: '2026-01-01T00:00:00Z',
  editor_note: '',
  sections: { industry: [], research: [], opportunities: [], discussions: [] },
});
const weeks = [mk('2026-W26'), mk('2026-W27'), mk('2026-W25')];

describe('weeks helpers', () => {
  test('sortWeeksDesc orders newest first without mutating input', () => {
    const sorted = sortWeeksDesc(weeks);
    expect(sorted.map((w) => w.week)).toEqual(['2026-W27', '2026-W26', '2026-W25']);
    expect(weeks[0].week).toBe('2026-W26');
  });
  test('latestWeek returns the newest', () => {
    expect(latestWeek(weeks)?.week).toBe('2026-W27');
  });
  test('getWeek finds by key', () => {
    expect(getWeek(weeks, '2026-W26')?.week).toBe('2026-W26');
    expect(getWeek(weeks, '2026-W99')).toBeUndefined();
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `pnpm --filter femtech-radar-site exec vitest run src/lib/weeks.test.ts`
Expected: FAIL — `./weeks` not found.

- [ ] **Step 9: Write `site/src/lib/weeks.ts`**

```ts
import type { WeeklyDataWithWhy } from './schema';

export function sortWeeksDesc(weeks: WeeklyDataWithWhy[]): WeeklyDataWithWhy[] {
  return [...weeks].sort((a, b) => (a.week < b.week ? 1 : a.week > b.week ? -1 : 0));
}

export function latestWeek(weeks: WeeklyDataWithWhy[]): WeeklyDataWithWhy | undefined {
  return sortWeeksDesc(weeks)[0];
}

export function getWeek(weeks: WeeklyDataWithWhy[], key: string): WeeklyDataWithWhy | undefined {
  return weeks.find((w) => w.week === key);
}
```

- [ ] **Step 10: Run tests + commit**

Run: `pnpm --filter femtech-radar-site exec vitest run`
Expected: PASS (all lib tests).
```bash
git add site/src/lib/schema.ts site/src/lib/schema.test.ts site/src/content.config.ts site/src/lib/weeks.ts site/src/lib/weeks.test.ts
git commit -m "feat(site): data layer reusing RadarItemSchema (keeps why_it_matters) + week helpers"
```

---

### Task 3: Utilities, layout, components, and warm-magazine theme

> Use the **frontend-design** skill for the visual pass. The class names and structure below are fixed (pages depend on them); the color/spacing values in `global.css` are a warm-magazine starting palette to refine.

**Files:**
- Create: `site/src/lib/strip-html.ts` (+test), `site/src/lib/with-base.ts` (+test), `site/src/styles/global.css`, `site/src/layouts/BaseLayout.astro`, `site/src/components/RadarCard.astro`, `site/src/components/SectionBlock.astro`

**Interfaces:**
- Consumes: `WeeklyDataWithWhy`, `RadarItemWithWhy`, `SectionKey`, `SECTION_KEYS` (Task 2).
- Produces:
  - `stripHtml(input: string): string`, `truncate(input: string, max?: number): string`
  - `joinBase(base: string, path: string): string`, `withBase(path: string): string`
  - `BaseLayout` (props: `title: string`, optional `description: string`)
  - `RadarCard` (props: `item: RadarItemWithWhy`)
  - `SectionBlock` (props: `section: SectionKey`, `items: RadarItemWithWhy[]`)

- [ ] **Step 1: Write the failing strip-html test**

`site/src/lib/strip-html.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { stripHtml, truncate } from './strip-html';

describe('stripHtml', () => {
  test('removes tags and decodes common entities', () => {
    const html = '<a href="x">FDA headlines</a>&nbsp;&nbsp;<font color="#666">Contemporary OB/GYN</font>';
    expect(stripHtml(html)).toBe('FDA headlines Contemporary OB/GYN');
  });
  test('leaves plain text intact', () => {
    expect(stripHtml('A plain abstract.')).toBe('A plain abstract.');
  });
});

describe('truncate', () => {
  test('truncates on a word boundary with an ellipsis', () => {
    expect(truncate('one two three four', 9)).toBe('one two…');
  });
  test('returns short input unchanged', () => {
    expect(truncate('short', 100)).toBe('short');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter femtech-radar-site exec vitest run src/lib/strip-html.test.ts`
Expected: FAIL — `./strip-html` not found.

- [ ] **Step 3: Write `site/src/lib/strip-html.ts`**

```ts
const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#?\w+;/g, (m) => ENTITIES[m] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(input: string, max = 240): string {
  if (input.length <= max) return input;
  return input.slice(0, max).replace(/\s+\S*$/, '') + '…';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter femtech-radar-site exec vitest run src/lib/strip-html.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing with-base test**

`site/src/lib/with-base.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { joinBase } from './with-base';

describe('joinBase', () => {
  test('joins base and path without doubling slashes', () => {
    expect(joinBase('/femtech-radar/', '/archive')).toBe('/femtech-radar/archive');
    expect(joinBase('/femtech-radar', 'archive')).toBe('/femtech-radar/archive');
  });
  test('root path yields base root', () => {
    expect(joinBase('/femtech-radar/', '/')).toBe('/femtech-radar/');
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `pnpm --filter femtech-radar-site exec vitest run src/lib/with-base.test.ts`
Expected: FAIL — `./with-base` not found.

- [ ] **Step 7: Write `site/src/lib/with-base.ts`**

```ts
export function joinBase(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

export function withBase(path: string): string {
  return joinBase(import.meta.env.BASE_URL, path);
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm --filter femtech-radar-site exec vitest run src/lib/with-base.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Write `site/src/styles/global.css` (warm-magazine tokens)**

```css
:root {
  --bg: #fffaf5;
  --surface: #ffffff;
  --ink: #2b2024;
  --muted: #6b5d63;
  --rose: #d6336c;
  --rose-soft: #ffe3ee;
  --border: #f0e3da;
  --radius: 14px;
  --shadow: 0 1px 2px rgba(43, 32, 36, .04), 0 8px 24px rgba(43, 32, 36, .06);
  --industry: #e8590c;
  --research: #7048e8;
  --opportunities: #0ca678;
  --discussions: #1c7ed6;
  --maxw: 64rem;
}
* { box-sizing: border-box; }
html { color-scheme: light; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: 'Inter', system-ui, sans-serif;
  line-height: 1.6;
}
h1, h2, h3 { font-family: 'Fraunces', Georgia, serif; line-height: 1.15; }
a { color: var(--rose); text-decoration: none; }
a:hover { text-decoration: underline; }
.wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 1.25rem; }
.site-header { border-bottom: 1px solid var(--border); background: var(--surface); }
.site-header .wrap { display: flex; align-items: center; justify-content: space-between; padding-top: 1rem; padding-bottom: 1rem; }
.brand { font-family: 'Fraunces', serif; font-weight: 600; font-size: 1.25rem; color: var(--ink); }
.nav a { color: var(--muted); margin-left: 1rem; font-size: .95rem; }
.editor-note { background: var(--rose-soft); border-radius: var(--radius); padding: 1.25rem 1.5rem; margin: 1.5rem 0; }
.section { margin: 2.5rem 0; }
.section-head { display: flex; align-items: center; gap: .6rem; margin-bottom: 1rem; }
.section-dot { width: .65rem; height: .65rem; border-radius: 50%; }
.cards { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr)); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1.1rem 1.2rem; display: flex; flex-direction: column; gap: .55rem; }
.card h3 { margin: 0; font-size: 1.05rem; }
.card .why { color: var(--ink); }
.card .summary { color: var(--muted); font-size: .92rem; }
.meta { display: flex; align-items: center; gap: .5rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .78rem; color: var(--muted); }
.score { font-family: ui-monospace, monospace; font-weight: 600; background: var(--rose-soft); color: var(--rose); border-radius: 999px; padding: .05rem .5rem; }
.empty { color: var(--muted); font-style: italic; }
.site-footer { border-top: 1px solid var(--border); margin-top: 4rem; padding: 2rem 0; color: var(--muted); font-size: .9rem; }
```

- [ ] **Step 10: Write `site/src/layouts/BaseLayout.astro`**

```astro
---
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '../styles/global.css';
import { withBase } from '../lib/with-base';

interface Props {
  title: string;
  description?: string;
}
const { title, description = 'A weekly, curated digest of FemTech industry news and women’s-health research.' } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="alternate" type="application/rss+xml" title="FemTech Radar" href={withBase('/rss.xml')} />
  </head>
  <body>
    <header class="site-header">
      <div class="wrap">
        <a class="brand" href={withBase('/')}>FemTech Radar</a>
        <nav class="nav">
          <a href={withBase('/')}>Latest</a>
          <a href={withBase('/archive')}>Archive</a>
          <a href={withBase('/sources')}>Sources</a>
          <a href={withBase('/rss.xml')}>RSS</a>
        </nav>
      </div>
    </header>
    <main class="wrap">
      <slot />
    </main>
    <footer class="site-footer">
      <div class="wrap">
        <p>FemTech Radar — curated by an MCP × GitHub Agentic Workflow pipeline. Built by
          <a href="https://github.com/ChanMeng666">Chan Meng</a>.
          <a href={withBase('/rss.xml')}>Subscribe via RSS</a>.</p>
      </div>
    </footer>
  </body>
</html>
```

- [ ] **Step 11: Write `site/src/components/RadarCard.astro`**

```astro
---
import type { RadarItemWithWhy } from '../lib/schema';
import { stripHtml, truncate } from '../lib/strip-html';

interface Props { item: RadarItemWithWhy; }
const { item } = Astro.props;
const summary = truncate(stripHtml(item.summary), 220);
const date = new Date(item.published_at).toISOString().slice(0, 10);
---
<article class="card">
  <h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a></h3>
  {item.why_it_matters && <p class="why">{item.why_it_matters}</p>}
  {summary && <p class="summary">{summary}</p>}
  <div class="meta">
    <span class="score">{item.score}</span>
    <span>{item.source}</span>
    <span>·</span>
    <span>{date}</span>
  </div>
</article>
```

- [ ] **Step 12: Write `site/src/components/SectionBlock.astro`**

```astro
---
import type { RadarItemWithWhy, SectionKey } from '../lib/schema';
import RadarCard from './RadarCard.astro';

interface Props { section: SectionKey; items: RadarItemWithWhy[]; }
const { section, items } = Astro.props;

const LABELS: Record<SectionKey, string> = {
  industry: 'Industry',
  research: 'Research',
  opportunities: 'Opportunities',
  discussions: 'Discussions',
};
const color = `var(--${section})`;
---
<section class="section">
  <div class="section-head">
    <span class="section-dot" style={`background:${color}`}></span>
    <h2 style={`color:${color}`}>{LABELS[section]}</h2>
  </div>
  {items.length > 0 ? (
    <div class="cards">
      {items.map((item) => <RadarCard item={item} />)}
    </div>
  ) : (
    <p class="empty">No items this week — this section arrives in v2.</p>
  )}
</section>
```

- [ ] **Step 13: Build to verify components compile, then commit**

Run: `pnpm --filter femtech-radar-site build`
Expected: build succeeds (components are not yet referenced by a page, but `astro check` in Task 8 / build parse them; a build here confirms no syntax errors in CSS import).
```bash
git add site/src/lib/strip-html.ts site/src/lib/strip-html.test.ts site/src/lib/with-base.ts site/src/lib/with-base.test.ts site/src/styles/global.css site/src/layouts/BaseLayout.astro site/src/components/RadarCard.astro site/src/components/SectionBlock.astro
git commit -m "feat(site): warm-magazine layout, RadarCard/SectionBlock, strip-html + with-base utils"
```

---

### Task 4: Home page (`/`) — latest week

**Files:**
- Modify: `site/src/pages/index.astro` (replace the placeholder)

**Interfaces:**
- Consumes: `getCollection('radar')`, `latestWeek` (Task 2), `BaseLayout`, `SectionBlock`, `SECTION_KEYS`.
- Produces: the home route rendering the latest week's 4 sections + pinned `editor_note`.

- [ ] **Step 1: Replace `site/src/pages/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import SectionBlock from '../components/SectionBlock.astro';
import { latestWeek } from '../lib/weeks';
import { SECTION_KEYS } from '../lib/schema';
import type { WeeklyDataWithWhy } from '../lib/schema';

const entries = await getCollection('radar');
const weeks = entries.map((e) => e.data as WeeklyDataWithWhy);
const current = latestWeek(weeks);
const generated = current ? new Date(current.generated_at).toISOString().slice(0, 10) : '';
---
<BaseLayout title="FemTech Radar — Latest">
  {current ? (
    <>
      <h1>FemTech Radar</h1>
      <p class="meta"><strong>Week {current.week}</strong> · generated {generated}</p>
      <div class="editor-note"><p>{current.editor_note}</p></div>
      {SECTION_KEYS.map((key) => <SectionBlock section={key} items={current.sections[key]} />)}
    </>
  ) : (
    <p class="empty">No weekly data yet. Check back after the next Monday run.</p>
  )}
</BaseLayout>
```

- [ ] **Step 2: Build and verify the home page renders the real week**

Run: `pnpm --filter femtech-radar-site build`
Expected: build succeeds. Confirm `site/dist` contains an `index.html` for the base path and that it contains the text `Week 2026-W27` and at least one item title (e.g. `mamabench`):
```bash
grep -rl "2026-W27" site/dist/ && grep -rl "mamabench" site/dist/
```
Expected: both grep commands print a matching `index.html` path.

- [ ] **Step 3: Commit**

```bash
git add site/src/pages/index.astro
git commit -m "feat(site): home page renders latest week with 4 sections + editor note"
```

---

### Task 5: Archive (`/archive`) and single-week (`/week/[week]`) pages

**Files:**
- Create: `site/src/pages/archive.astro`, `site/src/pages/week/[week].astro`

**Interfaces:**
- Consumes: `getCollection('radar')`, `sortWeeksDesc` (Task 2), `withBase`, `BaseLayout`, `SectionBlock`, `SECTION_KEYS`.
- Produces: an archive index and one static page per week (`getStaticPaths`).

- [ ] **Step 1: Create `site/src/pages/archive.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import { sortWeeksDesc } from '../lib/weeks';
import { SECTION_KEYS } from '../lib/schema';
import { withBase } from '../lib/with-base';
import { truncate } from '../lib/strip-html';
import type { WeeklyDataWithWhy } from '../lib/schema';

const entries = await getCollection('radar');
const weeks = sortWeeksDesc(entries.map((e) => e.data as WeeklyDataWithWhy));
const count = (w: WeeklyDataWithWhy) => SECTION_KEYS.reduce((n, k) => n + w.sections[k].length, 0);
---
<BaseLayout title="FemTech Radar — Archive">
  <h1>Archive</h1>
  {weeks.length === 0 ? <p class="empty">No issues yet.</p> : (
    <div class="cards">
      {weeks.map((w) => (
        <article class="card">
          <h3><a href={withBase(`/week/${w.week}`)}>Week {w.week}</a></h3>
          <p class="summary">{truncate(w.editor_note, 160)}</p>
          <div class="meta"><span>{count(w)} items</span></div>
        </article>
      ))}
    </div>
  )}
</BaseLayout>
```

- [ ] **Step 2: Create `site/src/pages/week/[week].astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import SectionBlock from '../../components/SectionBlock.astro';
import { SECTION_KEYS } from '../../lib/schema';
import type { WeeklyDataWithWhy } from '../../lib/schema';

export async function getStaticPaths() {
  const entries = await getCollection('radar');
  return entries.map((e) => ({
    params: { week: e.data.week },
    props: { data: e.data as WeeklyDataWithWhy },
  }));
}

const { data } = Astro.props as { data: WeeklyDataWithWhy };
const generated = new Date(data.generated_at).toISOString().slice(0, 10);
---
<BaseLayout title={`FemTech Radar — ${data.week}`}>
  <h1>Week {data.week}</h1>
  <p class="meta">generated {generated}</p>
  <div class="editor-note"><p>{data.editor_note}</p></div>
  {SECTION_KEYS.map((key) => <SectionBlock section={key} items={data.sections[key]} />)}
</BaseLayout>
```

- [ ] **Step 3: Build and verify both routes emit**

Run: `pnpm --filter femtech-radar-site build`
Expected: build succeeds. Verify the week page and archive emitted:
```bash
ls site/dist/**/archive/index.html site/dist/**/week/2026-W27/index.html 2>/dev/null || find site/dist -path "*week/2026-W27/index.html" -o -path "*archive/index.html"
```
Expected: paths for both `archive/index.html` and `week/2026-W27/index.html` are listed.

- [ ] **Step 4: Commit**

```bash
git add site/src/pages/archive.astro site/src/pages/week/[week].astro
git commit -m "feat(site): archive index + single-week pages"
```

---

### Task 6: Sources transparency page (`/sources`)

**Files:**
- Create: `site/src/lib/sources.ts`, `site/src/pages/sources.astro`

**Interfaces:**
- Consumes: `getCollection('radar')`, `SECTION_KEYS`, `BaseLayout`.
- Produces: `CONFIGURED_SOURCES` (static snapshot matching `radar_sources`) and the `/sources` page.

- [ ] **Step 1: Create `site/src/lib/sources.ts`**

```ts
import type { SectionKey } from './schema';

export interface ConfiguredSource {
  section: SectionKey;
  name: string;
  detail: string;
  status: 'live' | 'planned';
}

// Snapshot of the MCP server's radar_sources output (v1 adapters).
export const CONFIGURED_SOURCES: ConfiguredSource[] = [
  { section: 'industry', name: 'Google News', detail: 'FemTech / women’s-health news query (RSS).', status: 'live' },
  { section: 'research', name: 'arXiv', detail: 'q-bio / cs.CY + women’s-health keyword search.', status: 'live' },
  { section: 'opportunities', name: '—', detail: 'No adapter yet; arriving in v2.', status: 'planned' },
  { section: 'discussions', name: '—', detail: 'No adapter yet; arriving in v2.', status: 'planned' },
];
```

- [ ] **Step 2: Create `site/src/pages/sources.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import { CONFIGURED_SOURCES } from '../lib/sources';
import { SECTION_KEYS } from '../lib/schema';
import type { WeeklyDataWithWhy } from '../lib/schema';

const entries = await getCollection('radar');
const weeks = entries.map((e) => e.data as WeeklyDataWithWhy);
const seen = new Set<string>();
for (const w of weeks) for (const k of SECTION_KEYS) for (const it of w.sections[k]) seen.add(it.source);
const observed = [...seen].sort();
---
<BaseLayout title="FemTech Radar — Sources">
  <h1>Sources</h1>
  <p>FemTech Radar is fully transparent. The deterministic MCP server fetches, dedupes, and scores items
     from the configured sources below; the editorial selection is made by a GitHub Agentic Workflow.</p>

  <h2>Configured sources</h2>
  <div class="cards">
    {CONFIGURED_SOURCES.map((s) => (
      <article class="card">
        <h3>{s.name}</h3>
        <p class="summary">{s.detail}</p>
        <div class="meta"><span class="score">{s.section}</span><span>{s.status}</span></div>
      </article>
    ))}
  </div>

  <h2>Sources observed in published data</h2>
  {observed.length > 0 ? <p>{observed.join(', ')}</p> : <p class="empty">None yet.</p>}
</BaseLayout>
```

- [ ] **Step 3: Build and verify**

Run: `pnpm --filter femtech-radar-site build`
Expected: build succeeds; `find site/dist -path "*sources/index.html"` lists the page, and it contains `arXiv` and `Google News`.

- [ ] **Step 4: Commit**

```bash
git add site/src/lib/sources.ts site/src/pages/sources.astro
git commit -m "feat(site): sources transparency page"
```

---

### Task 7: RSS feed (`/rss.xml`)

**Files:**
- Create: `site/src/lib/rss.ts`, `site/src/lib/rss.test.ts`, `site/src/pages/rss.xml.ts`

**Interfaces:**
- Consumes: `WeeklyDataWithWhy`, `SECTION_KEYS` (Task 2), `stripHtml`/`truncate` (Task 3), `getCollection`, `@astrojs/rss`.
- Produces: `toRssItems(weeks: WeeklyDataWithWhy[]): RssItem[]` and the `/rss.xml` endpoint.

- [ ] **Step 1: Write the failing rss-mapping test**

`site/src/lib/rss.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { toRssItems } from './rss';
import type { WeeklyDataWithWhy } from './schema';

const week: WeeklyDataWithWhy = {
  week: '2026-W27',
  generated_at: '2026-06-30T00:00:00Z',
  editor_note: 'note',
  sections: {
    industry: [{
      id: 'i1', section: 'industry', title: 'FDA news', url: 'https://news.example/1',
      source: 'Google News', summary: '<a href="x">FDA news</a>&nbsp;Contemporary',
      score: 39, published_at: '2026-06-29T20:33:05.000Z', why_it_matters: 'Regulatory.',
    }],
    research: [{
      id: 'r1', section: 'research', title: 'A paper', url: 'http://arxiv.org/abs/1',
      source: 'arXiv', summary: 'An abstract.', score: 55,
      published_at: '2026-06-28T15:51:53Z', why_it_matters: 'Open benchmark.',
    }],
    opportunities: [], discussions: [],
  },
};

describe('toRssItems', () => {
  test('flattens all items, newest first, with stripped descriptions', () => {
    const items = toRssItems([week]);
    expect(items.map((i) => i.guid)).toEqual(['i1', 'r1']); // i1 is newer
    expect(items[0].link).toBe('https://news.example/1');
    expect(items[0].categories).toEqual(['industry']);
    expect(items[0].description).toContain('Regulatory.');
    expect(items[0].description).not.toContain('<a');
    expect(items[0].pubDate instanceof Date).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter femtech-radar-site exec vitest run src/lib/rss.test.ts`
Expected: FAIL — `./rss` not found.

- [ ] **Step 3: Write `site/src/lib/rss.ts`**

```ts
import type { WeeklyDataWithWhy } from './schema';
import { SECTION_KEYS } from './schema';
import { stripHtml, truncate } from './strip-html';

export interface RssItem {
  title: string;
  link: string;
  guid: string;
  pubDate: Date;
  description: string;
  categories: string[];
}

export function toRssItems(weeks: WeeklyDataWithWhy[]): RssItem[] {
  const items: RssItem[] = [];
  for (const week of weeks) {
    for (const key of SECTION_KEYS) {
      for (const it of week.sections[key]) {
        const why = it.why_it_matters ? `${it.why_it_matters} ` : '';
        const summary = truncate(stripHtml(it.summary), 280);
        items.push({
          title: it.title,
          link: it.url,
          guid: it.id,
          pubDate: new Date(it.published_at),
          description: `${why}${summary}`.trim(),
          categories: [key],
        });
      }
    }
  }
  return items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter femtech-radar-site exec vitest run src/lib/rss.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Write `site/src/pages/rss.xml.ts`**

```ts
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { toRssItems } from '../lib/rss';
import type { WeeklyDataWithWhy } from '../lib/schema';

export async function GET(context: APIContext) {
  const entries = await getCollection('radar');
  const weeks = entries.map((e) => e.data as WeeklyDataWithWhy);
  return rss({
    title: 'FemTech Radar',
    description: 'A weekly, curated digest of FemTech industry news and women’s-health research.',
    site: context.site ?? 'https://chanmeng666.github.io/femtech-radar',
    items: toRssItems(weeks).map((i) => ({
      title: i.title,
      link: i.link,
      pubDate: i.pubDate,
      description: i.description,
      categories: i.categories,
    })),
  });
}
```

> Note: `@astrojs/rss` uses each item's `link` as its `<guid>` by default, which is unique per item — no custom guid needed.

- [ ] **Step 6: Build and verify the feed emits and is well-formed**

Run: `pnpm --filter femtech-radar-site build`
Expected: build succeeds; `find site/dist -name rss.xml` lists the feed. Verify it parses and has items:
```bash
node -e "const f=require('node:fs');const p=require('node:child_process').execSync('node -e \"process.stdout.write(require(\\'node:fs\\').readdirSync(\\'site/dist\\').join())\"');" 2>/dev/null
node --input-type=module -e "import {readFileSync} from 'node:fs'; import {execSync} from 'node:child_process'; const path=execSync('find site/dist -name rss.xml').toString().trim().split('\n')[0]; const xml=readFileSync(path,'utf8'); if(!xml.includes('<rss')||!xml.includes('<item>')) throw new Error('bad feed'); console.log('rss ok:', (xml.match(/<item>/g)||[]).length, 'items');"
```
Expected: `rss ok: 6 items` (W27 has 3 industry + 3 research).

- [ ] **Step 7: Commit**

```bash
git add site/src/lib/rss.ts site/src/lib/rss.test.ts site/src/pages/rss.xml.ts
git commit -m "feat(site): RSS feed (full, newest-first, stripped descriptions)"
```

---

### Task 8: Deploy workflow + CI integration

**Files:**
- Create: `.github/workflows/deploy-pages.yml`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the buildable site (Tasks 1–7), the mcp package build.
- Produces: a Pages deployment on `data/**` or `site/**` changes; CI that type-checks, tests, and builds the site on PRs.

- [ ] **Step 1: Create `.github/workflows/deploy-pages.yml`**

```yaml
name: Deploy Pages
on:
  push:
    branches: [master]
    paths:
      - 'data/**'
      - 'site/**'
      - 'packages/mcp-server/**'
      - '.github/workflows/deploy-pages.yml'
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @chanmeng666/femtech-radar-mcp build
      - run: pnpm --filter femtech-radar-site build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site/dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Extend `.github/workflows/ci.yml`** — append these steps after the existing data-validation step (inside the same `test-and-validate` job, same indentation as the other `- run:` steps):

```yaml
      - name: Build the MCP package (for site schema import)
        run: pnpm --filter @chanmeng666/femtech-radar-mcp build
      - name: Type-check the site
        run: pnpm --filter femtech-radar-site exec astro check
      - name: Unit-test the site
        run: pnpm --filter femtech-radar-site test
      - name: Build the site
        run: pnpm --filter femtech-radar-site build
```

> If `ci.yml` already builds the mcp package earlier, skip the duplicate build step; keep the order so the package is built before `astro check`/`build`.

- [ ] **Step 3: Validate the YAML locally**

Run:
```bash
npx --yes js-yaml .github/workflows/deploy-pages.yml >/dev/null && npx --yes js-yaml .github/workflows/ci.yml >/dev/null && echo "yaml ok"
```
Expected: `yaml ok`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy-pages.yml .github/workflows/ci.yml
git commit -m "ci(site): GitHub Pages deploy workflow + site check/build in CI"
```

---

### Task 9: Docs, acceptance, and finish (human-gated)

**Files:**
- Modify: `README.md`, `AGENTS.md`, `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: everything above, merged to `master`.
- Produces: enabled Pages, a live verified site + subscribable RSS, updated docs.

> The Pages-enable + live deploy are **manual / human-gated** (one-time repo setting + a real Actions run). The implementer documents results; the user authorizes the run.

- [ ] **Step 1: Update `README.md`** — set the Live Demo link to `https://chanmeng666.github.io/femtech-radar/` and add a one-line "Subscribe via RSS: `…/femtech-radar/rss.xml`" note in the intro/usage section. Add the Astro site to the Tech Stack.

- [ ] **Step 2: Update `AGENTS.md`** — add to the Commands block:
```bash
# Build the Astro site
pnpm --filter femtech-radar-site build
# Type-check + unit-test the site
pnpm --filter femtech-radar-site exec astro check
pnpm --filter femtech-radar-site test
```
And note under Scope that Unit ③ (the site) now exists in `site/`, reads `data/*.json`, and deploys via `deploy-pages.yml`.

- [ ] **Step 3: Commit docs**

```bash
git add README.md AGENTS.md
git commit -m "docs: add Astro site (live demo, RSS, site commands)"
```

- [ ] **Step 4: (Human) Enable GitHub Pages** — repo Settings → Pages → Build and deployment → Source: **GitHub Actions**. (One-time; required before the first deploy succeeds.)

- [ ] **Step 5: (Human) Merge to master and verify the deploy**

After the branch PR is merged to `master`, the `deploy-pages.yml` workflow runs (data/site paths changed). Confirm:
```bash
gh run list --workflow=deploy-pages.yml --limit 1
```
Expected: a successful run. Then load `https://chanmeng666.github.io/femtech-radar/` — the home page shows Week 2026-W27, the editor note, and the Industry/Research sections (Opportunities/Discussions show the v2 empty state).

- [ ] **Step 6: (Human) Verify RSS subscribability**

Open `https://chanmeng666.github.io/femtech-radar/rss.xml` in a browser/feed reader. Expected: well-formed feed with 6 items; subscribing in a reader works. Internal links on the site resolve under `/femtech-radar/` (no 404s).

- [ ] **Step 7: Record outcome in `.superpowers/sdd/progress.md`** — the deploy run URL, the live site URL, the RSS URL, and the acceptance result. Then proceed to **finishing-a-development-branch**.

---

## Self-Review

**Spec coverage (Unit ③ of the design spec §6):**
- `/` home: latest week, 4 sections, `editor_note` pinned → Task 4 ✓
- `/archive` list by week → Task 5 ✓
- `/week/[week]` single issue → Task 5 ✓
- `/sources` transparency snapshot → Task 6 ✓
- `/rss.xml` full feed (subscribability) → Task 7 ✓
- i18n routing reserved → single `en` locale, no `[locale]` routing built (YAGNI; documented) ✓
- Builds from `data/` only, no runtime API → content-layer glob loader, Task 2 ✓
- `deploy-pages.yml` triggers on `data/**`, decoupled from gh aw → Task 8 ✓
- Content-first typography, section color-coding, house-style brand block → Task 3 ✓
- Public repo, free Pages → Global Constraints ✓
- Reuse `RadarItemSchema` (not redefine) + keep `why_it_matters` → Task 2 ✓
- Deferred to v2: per-section feeds, opportunities/discussions adapters, full bilingual.

**Placeholder scan:** No TBD/TODO. The two human-gated actions (enable Pages, live deploy in Task 9) are explicitly marked with exact settings/commands/expected output.

**Type consistency:** `WeeklyDataWithWhy` / `RadarItemWithWhy` / `SectionKey` / `SECTION_KEYS` defined in Task 2 (`src/lib/schema.ts`) and consumed verbatim by Tasks 3–7. `withBase`/`joinBase`, `stripHtml`/`truncate`, `toRssItems`/`RssItem`, `sortWeeksDesc`/`latestWeek`/`getWeek`, `CONFIGURED_SOURCES` names match across producer and consumer tasks. The content collection is named `radar` consistently (Tasks 2, 4, 5, 6, 7). Section accent CSS vars (`--industry`/`--research`/`--opportunities`/`--discussions`) match `SectionBlock`'s `var(--${section})`.

**Known soft spots (call out at execution):**
1. Content-layer `glob` with `base: '../data'` (outside `srcDir`) — primary approach per Astro docs ("anywhere on the filesystem"); Task 2 Step 6 is the empirical gate, with a documented prebuild-copy fallback.
2. Astro's `dist/` emit layout under a non-root `base` — verification greps/`find` for the emitted files rather than hard-coding the exact path, so it's robust to whether Astro nests under `dist/femtech-radar/` or `dist/`.
3. Zod instance reuse across the workspace package and the site — both are Zod v3; if Astro rejects the schema object, redefine the field shapes with `astro/zod` while keeping the same structure (still reusing the field list from `RadarItemSchema` as the source of truth).
