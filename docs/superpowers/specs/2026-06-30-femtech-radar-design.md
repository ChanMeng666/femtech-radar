# femtech-radar — Design Spec

- **Status:** Approved design (brainstorming complete) — ready for implementation planning
- **Date:** 2026-06-30
- **Owner:** Chan Meng (@ChanMeng666)
- **Repo (new, standalone):** `D:\github_repository\femtech-radar` → GitHub public repo `ChanMeng666/femtech-radar`
- **License:** MIT

## 1. Purpose

A **content-first, subscribable FemTech intelligence site** that publishes a curated weekly digest across four sections — FemTech industry, women's-health research, women-in-tech opportunities, and relevant tech discussion. Built entirely on GitHub-native primitives (GitHub Agentic Workflows + Actions + Pages) plus a reusable MCP server.

Primary goal: **genuinely useful to FemTech / women-in-tech practitioners** (content value first). Technical architecture (`gh aw × MCP × Pages`) is the means, and a deliberate secondary benefit — a flagship portfolio artifact and blog/talk material.

This single flagship project integrates three originally-separate ideas:
1. Weekly FemTech digest (scheduled scraping → weekly issue)
2. MCP × Agentic Workflows (a workflow that calls a custom MCP server)
3. GitHub Pages auto-updating showcase site

## 2. Success Criteria

- [ ] A public site on GitHub Pages shows the latest weekly radar across 4 sections, with an editor's note.
- [ ] An RSS/Atom feed lets readers subscribe.
- [ ] Each Monday, a `gh aw` workflow auto-produces the week's content with no manual scraping.
- [ ] The `femtech-radar` MCP server runs standalone (e.g., Claude Desktop) and is unit-tested.
- [ ] Weekly content lands as an auditable PR (human review gate) plus a summary GitHub Issue.
- [ ] Runs at ~zero recurring cost (public repo ⇒ free Actions + Pages; Copilot credits only).

## 3. Architecture Overview

A three-unit **scrape → curate → publish** pipeline, decoupled by two well-defined interfaces.

```
                         ┌── Interface ①: RadarItem[] (MCP tool return) ──┐
 Sources (4 types) ─► ① femtech-radar MCP ─► ② gh aw weekly workflow ─► Interface ②: data/YYYY-Www.json
                        (deterministic:        (editorial judgment:            │
                         fetch/dedup/score)     Copilot curates)               ▼
                                                      │              ③ Astro static site + RSS
                                                create-issue                (builds from data/, auto-deploy)
                                                (summary + notify + future ChatOps)
```

**Core principle — separation of determinism vs judgment:**
- The **MCP server** does only deterministic work (fetch, normalize, dedup, score). Unit-testable; reusable outside this project.
- **Editorial judgment** (which items, the "why it matters" line, cross-section dedup, the editor's note) lives in the workflow's Copilot agent.

This keeps each unit independently understandable, testable, and replaceable.

## 4. Unit ① — `femtech-radar` MCP Server (the brain)

**Stack:** TypeScript + Node, `@modelcontextprotocol/sdk`, stdio transport. Published as npm package `@chanmeng666/femtech-radar-mcp` (npx-runnable in Actions; usable in Claude Desktop). Zod for schema validation. Vitest for tests.

**Exposed tools (Interface ①):**

| Tool | Input | Output |
|---|---|---|
| `radar_collect` | `{ section, since, limit, filters? }` | `RadarItem[]` (normalized) |
| `radar_sources` | `{}` | configured source list (for debugging / site "Sources" page) |

`section ∈ {industry, research, opportunities, discussions}`. One tool per section keeps payloads bounded and lets the workflow process sections independently.

**Source adapters (`adapters/`, one file each, uniform interface):**
- `industry` → Google News query logic (reuse from `server-google-news`) + FemTech industry RSS (e.g., Femtech Insider)
- `research` → arXiv API (q-bio / cs.CY + women's-health keywords) + PubMed E-utilities + bioRxiv
- `opportunities` → jobs/LinkedIn MCP logic (reuse) + community/events RSS
- `discussions` → Hacker News Algolia Search API + Reddit (e.g., r/femtech)

**Deterministic pipeline:** `fetch → normalize → dedup → score`
- **normalize:** every source → unified `RadarItem`
- **dedup:** URL canonicalization + title-similarity (Jaccard / simple simhash) across sources
- **score:** `relevance(keyword/topic hits) × popularity(score/points/citations) × freshness`, normalized 0–100
- **graceful degradation:** any source timeout/failure → skip and annotate; never fail the whole call

**RadarItem schema (internal contract; the element type of Interface ①):**
```ts
{
  id: string            // stable hash(url)
  section: Section
  title: string
  url: string
  source: string        // "arXiv" | "Hacker News" | ...
  summary: string       // source-provided abstract or truncated body
  score: number         // 0-100
  published_at: string  // ISO
  raw_metrics?: { points?: number; comments?: number; citations?: number }
}
```

The MCP does **not** write judgment text (e.g., "why this matters") — that is the agent's job. The MCP stays pure, deterministic, testable.

## 5. Unit ② — gh aw Weekly Workflow (orchestration + editorial)

**Files:** `.github/workflows/weekly-radar.md` (+ compiled `.lock.yml`). **Engine:** Copilot.

**Frontmatter (key parts):**
```yaml
on:
  schedule: weekly on Monday    # fuzzy schedule; auto-adds workflow_dispatch
permissions:
  contents: read
  issues: write
  pull-requests: write
network:
  - news.google.com
  - export.arxiv.org
  - eutils.ncbi.nlm.nih.gov
  - hn.algolia.com
  - www.reddit.com
  # ...all source domains
mcp-servers:
  femtech-radar:
    command: npx
    args: ["-y", "@chanmeng666/femtech-radar-mcp"]
safe-outputs:
  create-pull-request:        # commit the week's data file → review gate → triggers deploy
    max: 1
  create-issue:               # weekly summary + notification + community/ChatOps entry
    max: 1
```

**Prompt body (editorial logic, natural language):** For each section (v1: industry + research), call `radar_collect`; pick Top N; write a one-sentence "why this matters to FemTech practitioners" per item; dedup across sections; write a short weekly `editor_note`. Produce two outputs:
1. **create-pull-request** → writes `data/YYYY-Www.json` (Interface ②, the site's single source of truth)
2. **create-issue** → title `FemTech Radar – Week WW`, body = Markdown digest (human-readable + notification + comment thread = community discussion + future `/deep-dive` ChatOps mount point)

**Why a PR, not a direct push:** gives content a human review gate (fits content-first), and the PR diff makes the agent's output fully auditable. v2 may auto-merge.

**Interface ② — `data/YYYY-Www.json`:**
```jsonc
{
  "week": "2026-W27",
  "generated_at": "<filled by workflow>",
  "editor_note": "Intro for the week…",
  "sections": {
    "industry":  [ /* RadarItem + why_it_matters */ ],
    "research":  [ /* ... */ ],
    "opportunities": [],   // v1 empty; v2 populated
    "discussions":   []
  }
}
```

## 6. Unit ③ — Astro Static Site + RSS (publishing layer)

**Build:** Astro reads `data/*.json` → static pages. A plain GitHub Actions workflow (`deploy-pages.yml`) triggers on `data/**` changes, builds, and deploys to Pages (decoupled from the gh aw workflow).

**Pages:**
- `/` home: latest week, 4 section tabs/columns, `editor_note` pinned
- `/archive`: list by week
- `/week/[week]`: single issue page
- `/sources`: transparency page (snapshot from `radar_sources`)
- `/rss.xml` (full Atom feed) + optional per-section feeds — **subscribability is the soul of an "intelligence site"**
- i18n routing reserved (bilingual — leverages owner's strength)

**Look & feel:** content-first typography (clear hierarchy, scannable cards, section color-coding). README and site carry the owner's personal-brand block (house style).

The site **reads only `data/` and depends on no runtime API** ⇒ pure static, fast, resilient to GitHub-API flakiness.

## 7. Repository Structure (pnpm monorepo)

```
femtech-radar/
├── packages/mcp-server/      # @chanmeng666/femtech-radar-mcp (TS, npm-publishable)
│   └── src/{index,tools,schema,dedup,score}.ts, adapters/*
├── site/                     # Astro site + RSS
├── data/                     # weekly JSON (site source of truth, Interface ②)
├── .github/workflows/
│   ├── weekly-radar.md / .lock.yml   # gh aw
│   └── deploy-pages.yml               # Astro build + deploy
├── docs/superpowers/specs/   # this spec
├── README.md (agent-first, house style)
└── LICENSE (MIT)
```

## 8. GitHub Pro / Ecosystem Resource Utilization

Key insight: **as a public OSS repo, Actions and Pages are free and unlimited** — Pro's 3,000-minute Actions quota never binds; the weekly workflow + deploy cost nothing. The only metered resource is **Copilot AI credits** (usage-based since 2026-06), and a weekly cadence (~4 runs/month) keeps that minimal.

**Live account data (measured 2026-06-30 via `gh api`, with `user` scope):**
- **Plan:** GitHub **Pro** (confirmed). Git storage allowance ~931 GB (≈3.3 GB used), unlimited private repos (26 owned), 7 collaborators.
- **Actions (private-repo billable minutes):** Linux usage averaged **~1,209 min/month** over H1 2026 against Pro's 3,000 included → **~1,790 min/month spare**. Public repos are not metered, so femtech-radar (public) costs **$0** regardless.
- **Copilot:** **active** — billing switched from "Premium Request" to "**AI Credits**" in 2026-06 (195 credits that month, net $0, within allowance). The `gh aw` engine prerequisite is **satisfied**.
- **Overages:** every 2026 line item is fully discounted (net $0) — no overspend; ample headroom.

| Resource | Live status | How femtech-radar exploits it |
|---|---|---|
| Actions | ~1,790 min/mo spare (private); free/unlimited (public) | Weekly workflow + Pages deploy + CI tests, all free on a public repo |
| Pages | free (public repos) | Hosts the Astro site; custom domain optional |
| Copilot | active, AI-Credits model, within allowance | Drives agent curation; low weekly consumption |
| Git storage | ~931 GB allowance, ~3.3 GB used | Effectively unbounded for this repo |
| Codespaces (Pro ~180 core-h/mo) | included | Cloud dev for MCP/Astro without local setup |
| Packages / Container Registry (Pro 2 GB) | included | Optional mirror publish of the MCP package/container |
| CodeQL + Dependabot | free (public repos) | Security scan + dependency updates on the MCP npm package → OSS credibility |
| GitHub Models | free inference allowance | Optional alternative/comparison engine (gh aw supports multiple engines) |

## 9. Testing Strategy

- **MCP:** Vitest. Per-adapter tests with mocked HTTP; dedup/score unit tests; Zod schema validation; graceful-degradation path tests.
- **Interface ②:** CI validates `data/*.json` against a JSON Schema to prevent dirty workflow output from polluting the site.
- **Site:** CI runs `astro build` + link check.
- **Workflow:** CI runs `gh aw compile` validation; the PR mode itself is a dry-run review.

## 10. Scope & Milestones (YAGNI)

| Stage | Deliverable |
|---|---|
| **v1 (end-to-end)** | MCP with **industry + research** adapters + collect/dedup/score; weekly workflow producing data PR + summary issue; Astro home/archive/RSS; manual PR merge |
| **v2 (complete + community)** | Add opportunities + discussions adapters; ChatOps `/deep-dive <topic>`; auto-merge; per-section RSS; **publish MCP to npm** |
| **v3 (polish)** | Theming / subscribe page / analytics; full bilingual; talk/blog output |

## 11. Costs & Risks

- **Cost:** weekly = ~4 runs/month; Copilot credits + Actions minutes both minimal; GitHub Pro fully covers it. Public repo ⇒ Actions/Pages free.
- **Source instability / rate limits** → adapter timeouts + retries + graceful degradation; `editor_note` notes any missing source.
- **Relevance quality** → keyword/topic config + agent editorial filter + PR human gate (triple gate).
- **gh aw still technical preview** → keep workflow simple; pin versions.
- **Network allowlist** must cover all source domains + the MCP, or the workflow fails to fetch.

## 12. Open Questions / Assumptions

- ~~Assumes Copilot Pro is active on the account (required by `gh aw`).~~ **Confirmed active** (2026-06 AI-Credits usage, net $0) — see §8.
- Exact source list per adapter to be finalized during implementation planning (v1 needs only industry + research).
- Auto-merge deferred to v2; v1 uses manual PR merge as the quality gate.
