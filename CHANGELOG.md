# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note:** the npm package `@chanmeng666/femtech-radar-mcp` (Unit ①) is versioned independently and
> is currently at `0.1.0`. Units ② (weekly workflow) and ③ (Astro site) ship via the repository on
> GitHub Actions / Pages rather than a package version, and are tracked under _Unreleased_ until tagged.

## [Unreleased]

### Added — vNext: 4-section pipeline + site polish
- `adapters/opportunities.ts` — LinkedIn Jobs adapter using the free guest endpoint (no API key; logic ported from the owner's `linkedin-jobs-search`). LinkedIn is best-effort — the guest endpoint may be rate-limited from CI; graceful degradation to `[]` applies. Opt-in SerpAPI Google Jobs path (ported from `server-google-jobs`) activates only when `SERP_API_KEY` env var is set; default remains LinkedIn.
- `adapters/discussions.ts` — merges two free, keyless sources: Hacker News Algolia (`hn.algolia.com`) and Mastodon public hashtag timelines (`mastodon.social`, tags `#femtech`/`#WomenInTech`/`#womenshealth`). Fixes the earlier HN query (Algolia has no boolean `OR`/phrase operators — now one query per term, merged and de-duped) which returned zero results. Per-source graceful degradation; adds `mastodon.social` to the workflow allowlist. Published as `@chanmeng666/femtech-radar-mcp@0.3.0`.
- `adapters/gnews-url.ts` — decodes Google News redirect URLs to publisher URLs in the industry adapter; fallback-safe (returns original URL on any failure).
- `adapters/utils.ts` — shared `hashId(url)` helper (SHA-256, first 16 hex chars) used by all adapters.
- `adapters/types.ts` — `Fetcher` type extended with optional `init.headers` (needed by the LinkedIn adapter to send a browser User-Agent).
- Weekly workflow (`weekly-radar.md`): now collects all four sections; `network.allowed` adds `www.linkedin.com`, `hn.algolia.com`, and `serpapi.com`; SerpAPI opt-in wiring documented in the workflow comment.
- Site: per-section RSS feeds at `/rss/<section>.xml` (e.g. `/rss/industry.xml`); favicon; `getWeeks`/`safeISODate` helpers; numeric-entity decode; sources page shows all four live sources.

### Added — Unit ③: Astro + RSS site (live)
- Astro 5 static site (`site/`, package `femtech-radar-site`) deployed to GitHub Pages at
  https://chanmeng666.github.io/femtech-radar/ — content-first, subscribable FemTech intelligence.
- Pages: home (latest week), `/archive`, `/week/[week]`, `/sources`, and a full RSS feed at `/rss.xml`.
- Reads the repo-root `data/*.json` in place via the Astro content-layer `glob` loader; reuses
  `RadarItemSchema` from `@chanmeng666/femtech-radar-mcp/schema`, extended to preserve the agent-added
  `why_it_matters`. Google News HTML in `summary` is stripped before render.
- `.github/workflows/deploy-pages.yml` — auto-build + deploy on `data/**` / `site/**` pushes to `master`.
- CI extended with `astro check` + site build/test.

### Added — Unit ②: weekly orchestration workflow
- `.github/workflows/weekly-radar.md` (+ compiled `.lock.yml`): a scheduled GitHub Agentic Workflow
  (`gh aw`, engine `copilot`, model `gpt-4.1`) that drives the MCP, lets Copilot curate the weekly
  digest (top items + per-item `why_it_matters` + `editor_note`), and emits a review-gated
  `create-pull-request` writing `data/YYYY-Www.json` plus a `create-issue` summary.
- `scripts/validate-data.mjs` (+ test) — CI data-contract guard reusing `WeeklyDataSchema`.
- First production digest committed: `data/2026-W27.json` (industry + research).
- Documentation and community-health files; AGENTS.md / README synced to the full live pipeline.

## [0.1.0] - 2026-06-30 — Unit ①: MCP server

### Added
- `@chanmeng666/femtech-radar-mcp` published to npm: a deterministic FemTech intelligence MCP server.
- Tools `radar_collect` (normalized, deduped, scored items per section) and `radar_sources`.
- Source adapters: `industry` (Google News) and `research` (arXiv), behind a uniform injected-`Fetcher`
  `Adapter` interface (zero real network calls in tests).
- Deterministic pipeline `fetch → normalize → dedupe → score → sort → since-filter`; `score` =
  `0.5·relevance + 0.3·popularity + 0.2·freshness`, clamped 0–100.
- Graceful degradation (a failing source yields `[]` + a warning, never throws out); 28 unit tests.
- Side-effect-free `./schema` subpath export of the shared `RadarItem` / `WeeklyData` Zod contract.
