# AGENTS.md

This file provides project guidance to AI coding assistants (Claude Code, GitHub Copilot, Cursor,
Codex, etc.) working with this repository. Read it before writing or changing any code.

## Project Overview

femtech-radar — Agent-first FemTech intelligence: an MCP server that fetches, dedupes, and scores women's-health & FemTech research and industry news, designed to feed GitHub Agentic Workflows and an auto-updating Astro + RSS site.

- **Primary language / stack:** TypeScript (strict, ESM) on Node.js ≥ 20, pnpm monorepo
- **Default branch:** `master`
- **Repository:** https://github.com/ChanMeng666/femtech-radar
- **Scope of v1:** the MCP server at `packages/mcp-server`. The `gh aw` workflow is a later plan. Unit ③ — the Astro site — now exists in `site/`, reads `data/*.json`, and deploys to GitHub Pages via `deploy-pages.yml`.

## Commands

```bash
# Install workspace dependencies
pnpm install

# Build the MCP server (tsup → dist/index.js)
pnpm --filter @chanmeng666/femtech-radar-mcp build

# Run the test suite (Vitest, 28 tests)
pnpm --filter @chanmeng666/femtech-radar-mcp test

# Type-check only
cd packages/mcp-server && pnpm exec tsc --noEmit

# Build the Astro site
pnpm --filter femtech-radar-site build
# Type-check + unit-test the site
pnpm --filter femtech-radar-site exec astro check
pnpm --filter femtech-radar-site test
```

> If a command above is missing or wrong, check the project manifest (e.g. `package.json` scripts,
> `Makefile`, `pyproject.toml`) and update this file — keeping AGENTS.md accurate is part of the work.

## Architecture & Conventions

The MCP server is a deterministic pipeline. Data flows: **source adapter → normalize → dedupe → score → sort → since-filter → MCP tool**.

Directory map (`packages/mcp-server/src/`):
- `schema.ts` — Zod `RadarItem` / `WeeklyData` and the `Section` enum. The shared data contract; later plans (workflow, site) consume these types.
- `adapters/types.ts` — the `Adapter`, `Fetcher`, `CollectOpts` contract. **All network I/O goes through the injected `Fetcher`** so adapters are unit-testable.
- `adapters/research.ts` (arXiv), `adapters/industry.ts` (Google News) — one file per source; each returns `RadarItem[]`.
- `dedup.ts` — `canonicalUrl` (strips tracking params, guards malformed URLs) + title-Jaccard dedupe, higher-score-wins.
- `score.ts` — `scoreItem` = `0.5·relevance + 0.3·popularity + 0.2·freshness`, clamped to 0–100, deterministic given `now`.
- `collect.ts` — orchestration + `httpFetcher` (real `fetch`, 10s timeout, `res.ok` guard) + the `ADAPTERS` registry.
- `tools.ts` / `index.ts` — `radar_collect` / `radar_sources` handlers and the stdio server.

Key conventions:
- **Determinism lives in the server; judgment lives in the agent.** Don't add summarization/editorial logic to the MCP — that belongs to the `gh aw` workflow that calls it.
- **Graceful degradation:** a failing source yields `[]` + a warning from `collect()`; it never throws out. Adapters propagate errors (they no longer swallow them); `collect()` converts them to warnings.

## Gotchas & Anti-patterns

- **ESM `.js` import suffixes are required.** Relative imports use `./foo.js` (not `./foo`) even though the source is `.ts`. Your editor's TS server may show "Cannot find module './foo.js'" — that's an editor artifact; the real gate is `pnpm exec tsc --noEmit`, which resolves `.js → .ts` via `moduleResolution: bundler`. Trust tsc and the Vitest run, not the squiggles.
- **Never call `fetch` directly in an adapter.** Take the injected `Fetcher` from `CollectOpts`. Tests pass fixtures through it; a direct `fetch` would make a real network call and break the "no network in tests" rule.
- **`@types/node` is required** for `node:crypto` and the `fetch`/`AbortController` globals to type-check. It's already a devDependency — don't remove it.
- **`server.tool()` is deprecated** in `@modelcontextprotocol/sdk` 1.29 (use `registerTool()` when migrating). It still works; a v2 cleanup item.
- **This is meant to run on a PUBLIC repo.** Public-repo Actions and Pages are free; making the repo private would start metering Actions minutes. Keep it public.
- **Don't hand-edit `dist/`** — it's produced by `pnpm … build`.

## Reading Order

When onboarding to this repo, read in this order:
1. `README.md` — what the project is and how to run it
2. This `AGENTS.md` — how to work in it
3. `CONTRIBUTING.md` — contribution workflow and quality gates

## Conventions for Changes

- Follow [Conventional Commits](https://www.conventionalcommits.org/).
- Run the project's lint/test commands before proposing changes.
- Keep this file up to date when you change build steps, structure, or conventions.
