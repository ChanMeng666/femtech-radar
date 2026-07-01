# AGENTS.md

This file provides project guidance to AI coding assistants (Claude Code, GitHub Copilot, Cursor,
Codex, etc.) working with this repository. Read it before writing or changing any code.

## Project Overview

femtech-radar — Agent-first FemTech intelligence: a three-unit **scrape → curate → publish** pipeline
that turns the scattered firehose of women's-health & FemTech signal into a curated, deduplicated,
ranked, **subscribable** weekly digest, built entirely on GitHub-native primitives plus a reusable MCP
server.

- **Primary language / stack:** TypeScript (strict, ESM) on Node.js ≥ 20, pnpm monorepo
- **Default branch:** `master`
- **Repository:** https://github.com/ChanMeng666/femtech-radar (public)
- **Live site:** https://chanmeng666.github.io/femtech-radar/ · **RSS:** https://chanmeng666.github.io/femtech-radar/rss.xml · **Per-section RSS:** `/rss/<section>.xml` (e.g. `/rss/industry.xml`)
- **npm package:** [`@chanmeng666/femtech-radar-mcp`](https://www.npmjs.com/package/@chanmeng666/femtech-radar-mcp) (v0.3.0)

**Status: all three units are built and live in production.** The pipeline runs end-to-end: the weekly
workflow calls the published MCP server, curates a digest, opens a data PR, and the site auto-deploys.
All four sections (`industry`, `research`, `opportunities`, `discussions`) now have source adapters and
are collected by the weekly workflow. Deferred to a future version: ChatOps slash commands and bilingual
support.

## The Three Units

```
 Sources ─► ① MCP server ─► ② weekly gh aw workflow ─► data/YYYY-Www.json ─► ③ Astro site + RSS
 (arXiv,    (deterministic:   (editorial judgment:        (Interface ②,         (reads data/, auto-
  Google     fetch/dedupe/     Copilot curates +           single source        deploys to Pages)
  News)      score)            writes why_it_matters)      of truth)
```

**Core principle — determinism vs judgment.** Unit ① does ONLY deterministic work (fetch, normalize,
dedupe, score) and is reusable/unit-tested. ALL editorial judgment (which items, the per-item
`why_it_matters` line, the weekly `editor_note`, cross-section dedup) lives in Unit ②'s Copilot agent.
Unit ③ is pure presentation and reads only committed data. Keep these responsibilities separate.

### Unit ① — MCP server (`packages/mcp-server/`) — published as `@chanmeng666/femtech-radar-mcp`

Deterministic pipeline. Data flows: **source adapter → normalize → dedupe → score → sort → since-filter → MCP tool**.

Directory map (`packages/mcp-server/src/`):
- `schema.ts` — Zod `RadarItem` / `WeeklyData` schemas and the `Section` enum. **The shared data contract.** Exposed to other units via the side-effect-free subpath `@chanmeng666/femtech-radar-mcp/schema`.
- `adapters/types.ts` — the `Adapter`, `Fetcher`, `CollectOpts` contract. **All network I/O goes through the injected `Fetcher`** so adapters are unit-testable. `Fetcher` accepts optional `init.headers` (needed by the LinkedIn adapter to pass a browser User-Agent).
- `adapters/research.ts` (arXiv), `adapters/industry.ts` (Google News) — one file per source; each returns `RadarItem[]`.
- `adapters/opportunities.ts` — default: LinkedIn Jobs free guest endpoint, logic ported from the owner's `linkedin-jobs-search`; opt-in: SerpAPI Google Jobs (`serpapi.com`), active only when `process.env.SERP_API_KEY` is set.
- `adapters/discussions.ts` — merges two free, keyless sources: Hacker News Algolia (`hn.algolia.com`; one query per term — Algolia has no boolean `OR`) and Mastodon public hashtag timelines (`mastodon.social/api/v1/timelines/tag/<tag>`). Per-source try/catch: one dead source degrades to `[]` and never zeroes the section (so this adapter does not throw out of `collect()`).
- `adapters/gnews-url.ts` — decodes Google News redirect URLs to publisher URLs; used by `industry.ts`; fallback-safe (returns the original URL on any failure).
- `adapters/utils.ts` — shared `hashId(url)` (SHA-256, first 16 hex chars) used by all adapters.
- `dedup.ts` — `canonicalUrl` (strips tracking params, guards malformed URLs) + title-Jaccard dedupe, higher-score-wins.
- `score.ts` — `scoreItem` = `0.5·relevance + 0.3·popularity + 0.2·freshness`, clamped to 0–100, deterministic given `now`.
- `collect.ts` — orchestration + `httpFetcher` (real `fetch`, 10s timeout, `res.ok` guard) + the `ADAPTERS` registry.
- `tools.ts` / `index.ts` — `radar_collect` / `radar_sources` handlers and the stdio server (`index.ts` runs `server.connect()` at import — importing the package ROOT boots the server).

### Unit ② — Weekly workflow (`.github/workflows/weekly-radar.md` + `.lock.yml`)

A [GitHub Agentic Workflow (`gh aw`)](https://github.github.com/gh-aw/). **Engine: copilot, model: `gpt-4.1`.**
Each Monday it launches the published MCP via `npx`, calls `radar_collect` for all four sections
(`industry`, `research`, `opportunities`, `discussions`), and the Copilot agent curates the results:
picks top items, writes a one-sentence `why_it_matters` per item, writes the weekly `editor_note`, then
emits two `safe-outputs`. `network.allowed` includes `www.linkedin.com`, `hn.algolia.com`,
`serpapi.com`, and `mastodon.social` in addition to the arXiv / Google News defaults.
1. `create-pull-request` → writes `data/YYYY-Www.json` (the site's single source of truth).
2. `create-issue` → a human-readable Markdown digest (notification + discussion thread).

The PR is a deliberate **human review gate** (content-first). `copilot-setup-steps.yml` provisions the
workflow runner. `ci.yml` validates committed data and re-checks the build.

### Unit ③ — Astro site + RSS (`site/`) — package `femtech-radar-site`

Astro 5 static site. Reads the repo-root `data/*.json` **in place** via the content-layer `glob` loader
(`src/content.config.ts`, `base: '../data'`), validates with a schema that **reuses** `RadarItemSchema`
(see Gotchas), and renders:
- `/` (latest week, 4 sections, pinned `editor_note`) · `/archive` · `/week/[week]` · `/sources` · `/rss.xml` · per-section feeds at `/rss/<section>.xml` (e.g. `/rss/industry.xml`).

Pure, unit-tested logic lives in `site/src/lib/` (`schema`, `weeks`, `strip-html`, `with-base`, `rss`,
`sources`); `.astro` files are thin views. `.github/workflows/deploy-pages.yml` builds and deploys to
GitHub Pages on `data/**` / `site/**` pushes to `master` (decoupled from the weekly workflow).

**Design system & branding.** The site is rebranded to match the parent **FemTech Weekend** org
(warm-brown "McKinsey editorial" style; light mode only). The **entire** design system is one vanilla
CSS file — `site/src/styles/global.css` (`:root` tokens + component rules) — with the FemTech Weekend
logo mark in the header/footer (`site/public/brand/femtech-weekend-logo.svg`) and a brand-brown favicon.
No Tailwind, no dark mode. **[`docs/design-system.md`](docs/design-system.md) is the authoritative,
current reference** (tokens, section colors, assets, and how to keep in sync with the parent brand) —
read it before touching any visual styling, and update it alongside token changes.

## Repository Layout

```
femtech-radar/
├── packages/mcp-server/   # Unit ①  @chanmeng666/femtech-radar-mcp (TS, npm-published)
├── site/                  # Unit ③  Astro 5 + RSS (femtech-radar-site)
├── data/                  # Interface ②  weekly JSON (e.g. data/2026-W27.json) — site's source of truth
├── scripts/               # validate-data.mjs (+ .test.mjs) — CI data-contract guard
├── .github/workflows/     # weekly-radar.md/.lock.yml (Unit ②) · deploy-pages.yml · ci.yml · copilot-setup-steps.yml
├── docs/superpowers/      # specs/ (design) · plans/ (per-unit implementation plans)
└── README.md · AGENTS.md · CONTRIBUTING.md · CHANGELOG.md · LICENSE (MIT)
```

## Data Contract (Interface ②)

`data/YYYY-Www.json` (ISO week key, e.g. `2026-W27`) validates against `WeeklyData`:
```jsonc
{ "week", "generated_at", "editor_note",
  "sections": { "industry": RadarItem[], "research": RadarItem[], "opportunities": RadarItem[], "discussions": RadarItem[] } }
```
`RadarItem`: `{ id, section, title, url, source, summary, score(0–100), published_at, raw_metrics? }`.
Unit ② additionally writes a `why_it_matters` string on each item (the editorial payload). All four
sections are live: `opportunities` uses LinkedIn (default) or SerpAPI Google Jobs (opt-in via
`SERP_API_KEY`); `discussions` merges Hacker News Algolia + Mastodon hashtag timelines.

## Commands

```bash
pnpm install                                              # install workspace deps

# Everything (both packages)
pnpm -r test                                             # mcp (28) + site (12) tests

# Unit ① — MCP server
pnpm --filter @chanmeng666/femtech-radar-mcp build       # tsup → dist/{index,schema}.js (+ .d.ts)
pnpm --filter @chanmeng666/femtech-radar-mcp test        # Vitest, 28 tests
cd packages/mcp-server && pnpm exec tsc --noEmit         # type-check only

# Unit ③ — Astro site
pnpm --filter femtech-radar-site dev                     # local dev server
pnpm --filter femtech-radar-site build                   # → site/dist (static)
pnpm --filter femtech-radar-site preview                 # serve the built site
pnpm --filter femtech-radar-site exec astro check        # type-check the site
pnpm --filter femtech-radar-site test                    # Vitest, 12 tests

# Interface ② — data contract
node scripts/validate-data.mjs                           # validate every data/*.json against WeeklyDataSchema

# Unit ② — weekly workflow (gh aw CLI)
gh aw compile weekly-radar                               # recompile after editing the .md frontmatter
gh aw run weekly-radar                                   # trigger a run (consumes Copilot credits)
```

> If a command above is missing or wrong, check the manifest (`package.json` scripts, the workflow
> files) and update this file — keeping AGENTS.md accurate is part of the work.

## Gotchas & Anti-patterns

### Cross-cutting
- **This MUST stay a PUBLIC repo.** Public-repo Actions and Pages are free; going private would meter Actions minutes and is the only thing that breaks the zero-cost model.
- **Don't hand-edit `dist/`** (any package) — it's produced by `pnpm … build`.
- **Module resolution differs by package — do not mix the two styles:**
  - `packages/mcp-server` uses NodeNext: relative imports **require `.js` suffixes** (`./foo.js` even though the source is `.ts`).
  - `site/` uses Vite/bundler resolution: imports are **extensionless** (`./foo`). Never carry the `.js` suffix into `site/`.
  - In BOTH, the editor's TS server may show spurious "Cannot find module" squiggles before a build/sync. The real gates are `tsc --noEmit` (mcp) and `astro check` (site) — trust those and the Vitest runs, not the squiggles.

### Unit ① (MCP server)
- **Never call `fetch` directly in an adapter.** Take the injected `Fetcher` from `CollectOpts`; tests pass fixtures through it. A direct `fetch` makes a real network call and breaks the "no network in tests" rule.
- **`@types/node` is required** (for `node:crypto` and the `fetch`/`AbortController` globals). Already a devDependency — don't remove it.
- **Graceful degradation:** a failing source yields `[]` + a warning from `collect()`; it never throws out. Adapters propagate errors; `collect()` converts them to warnings. The LinkedIn adapter is best-effort — the free guest endpoint may be rate-limited from CI; failures degrade gracefully to `[]`.
- **SerpAPI is opt-in, not default.** The `opportunities` adapter uses LinkedIn by default; SerpAPI Google Jobs activates only when `process.env.SERP_API_KEY` is set. Do not claim SerpAPI is the primary or default source.
- **`server.tool()` is deprecated** in `@modelcontextprotocol/sdk` 1.29 (migrate to `registerTool()`); still works, a vNext cleanup item.

### Unit ② (weekly workflow)
- **After editing `weekly-radar.md` frontmatter, run `gh aw compile weekly-radar` and commit BOTH the `.md` and the generated `.lock.yml`.** `gh aw` frontmatter is kebab-case (`mcp-servers`, `safe-outputs`, `network`).
- **SerpAPI opt-in for opportunities:** add a repo secret `SERP_API_KEY` (Settings → Secrets → Actions), then wire it into the `mcp-servers.femtech-radar.env` block in `weekly-radar.md` frontmatter and recompile. `network.allowed` already includes `serpapi.com`. Without the secret the adapter defaults to LinkedIn.
- **The engine model is pinned to `gpt-4.1`** for a reason: `claude-sonnet-4.6` is not enabled on the account, `gpt-4o` emits null-type tool calls, and `gpt-5.1` was retired. Don't "upgrade" it blindly.
- A live run consumes Copilot AI credits and writes to GitHub — treat it as a non-local, gated action.

### Unit ③ (Astro site)
- **Import the data contract from the subpath, NOT the package root.** Use `@chanmeng666/femtech-radar-mcp/schema`. Importing the root (`@chanmeng666/femtech-radar-mcp`) boots the stdio MCP server at import time.
- **Preserve `why_it_matters`.** `WeeklyDataSchema` is non-strict, so `.parse()` silently DROPS the agent-added `why_it_matters`. The site validates with an **extended** schema (`RadarItemSchema.extend({ why_it_matters: z.string().optional() })`) — see `site/src/lib/schema.ts`. A test guards this.
- **`summary` may contain raw HTML** (Google News items wrap the title in `<a>`/`<font>`); arXiv is plain text. Always render it through `stripHtml` (`site/src/lib/strip-html.ts`) — never `set:html`.
- **Respect the Pages base path.** Deploy is at the project sub-path `/femtech-radar`. Every internal link/asset must go through `withBase()` (`site/src/lib/with-base.ts`) or it 404s on Pages; the RSS feed builds absolute URLs from Astro's `site` + `BASE_URL`.
- **Keep logic in `site/src/lib/*.ts`** (unit-tested) and `.astro` files thin.
- **All visual styling is in one file: `site/src/styles/global.css`** (brand tokens in `:root`). Follow the FemTech Weekend brand — see [`docs/design-system.md`](docs/design-system.md) — and keep that doc in sync. The `@fontsource/fraunces`/`inter` deps in `site/package.json` are **no longer imported** (the rebrand uses Georgia + the system stack); they're kept only so `pnpm install --frozen-lockfile` in CI stays green. Remove them only together with a lockfile update.

## Reading Order

When onboarding to this repo, read in this order:
1. `README.md` — what the project is, how to run it, the live site
2. This `AGENTS.md` — how to work in it (architecture, commands, gotchas)
3. `docs/superpowers/specs/` — the full approved design (the three units in depth)
4. `docs/superpowers/plans/` — the per-unit implementation plans (task-level detail; the visual CSS in the astro-site plan is point-in-time and superseded by the design-system doc)
5. `docs/design-system.md` — the current visual identity / branding reference (Unit ③)
6. `CONTRIBUTING.md` — contribution workflow and quality gates

## Conventions for Changes

- Follow [Conventional Commits](https://www.conventionalcommits.org/).
- Develop on a feature branch, never directly on `master`; open a PR (CI gate).
- Run the relevant build/test/check commands before proposing changes.
- Keep this file up to date when you change build steps, structure, or conventions.
