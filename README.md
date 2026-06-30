<!-- AGENT-FIRST NOTICE -->
> [!IMPORTANT]
> ### 🤖 Read this with your AI agent — don't read it by hand.
> This repo is written agent-first. Point Claude Code, GitHub Copilot, Cursor, or any agent at it:
> *"Read the README and AGENTS.md, then help me run / extend this."*
> Structure + [`AGENTS.md`](AGENTS.md) are optimized for agent comprehension.
<!-- /AGENT-FIRST NOTICE -->

<div align="center"><a name="readme-top"></a>

<!-- Optional hero image / logo:
<img src="./.github/brand/your-logo.svg" alt="femtech-radar" width="120" />
-->

# 🚀 femtech-radar

### FemTech intelligence as a GitHub-native, agent-driven pipeline

Agent-first FemTech intelligence: an MCP server that fetches, dedupes, and scores women's-health & FemTech research and industry news, designed to feed GitHub Agentic Workflows and an auto-updating Astro + RSS site.

[Live Demo][demo-link] · [Documentation][docs-link] · [Changelog](CHANGELOG.md) · [Report Bug](https://github.com/ChanMeng666/femtech-radar/issues) · [Request Feature](https://github.com/ChanMeng666/femtech-radar/issues)

<!-- SHIELD GROUP -->

[![License](https://img.shields.io/github/license/ChanMeng666/femtech-radar?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/ChanMeng666/femtech-radar/ci.yml?style=flat-square)](https://github.com/ChanMeng666/femtech-radar/actions)
[![Contributors](https://img.shields.io/github/contributors/ChanMeng666/femtech-radar?style=flat-square)](https://github.com/ChanMeng666/femtech-radar/graphs/contributors)
[![Forks](https://img.shields.io/github/forks/ChanMeng666/femtech-radar?style=flat-square)](https://github.com/ChanMeng666/femtech-radar/network/members)
[![Stars](https://img.shields.io/github/stars/ChanMeng666/femtech-radar?style=flat-square)](https://github.com/ChanMeng666/femtech-radar/stargazers)
[![Issues](https://img.shields.io/github/issues/ChanMeng666/femtech-radar?style=flat-square)](https://github.com/ChanMeng666/femtech-radar/issues)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-EA4AAA?style=flat-square&logo=githubsponsors)](https://github.com/sponsors/ChanMeng666)

<!-- Tech stack badges — replace with your real stack:
![Next.js](https://img.shields.io/badge/Next.js-000?style=flat-square&logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
-->

</div>

<details>
<summary><kbd>📑 Table of Contents</kbd></summary>

- [🌟 Introduction](#-introduction)
- [✨ Key Features](#-key-features)
- [🛠️ Tech Stack](#-tech-stack)
- [🏗️ Architecture](#-architecture)
- [🚀 Getting Started](#-getting-started)
- [🛳 Project Status & Roadmap](#-project-status--roadmap)
- [📖 Usage Guide](#-usage-guide)
- [⌨️ Development](#-development)
- [🤝 Contributing](#-contributing)
- [❤️ Sponsor](#-sponsor)
- [📄 License](#-license)
- [🙋‍♀️ Author](#-author)

</details>

## 🌟 Introduction

The FemTech and women's-health world produces a scattered firehose of signal — research preprints, funding and product news, community opportunities, technical discussion — across dozens of sources. **femtech-radar** turns that noise into a curated, deduplicated, ranked digest, using only GitHub-native primitives plus a reusable [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server.

This repository is **v1: the MCP server** — the deterministic "brain" of the pipeline. It fetches items from multiple sources, normalizes them into one shape, removes duplicates, and scores each item by **relevance × popularity × freshness**, then exposes the result over MCP so it can be driven by a [GitHub Agentic Workflow (`gh aw`)](https://github.github.com/gh-aw/), Claude Desktop, or any MCP client.

It's built for **FemTech / women-in-tech practitioners** who want signal without the noise — and as a reference implementation of the `gh aw × MCP × GitHub Pages` pattern. The eventual product (see [Roadmap](#-project-status--roadmap)) is a subscribable weekly intelligence site that updates itself for free on a public GitHub repo.

## ✨ Key Features

`1` **One MCP tool, a whole radar** — `radar_collect` returns normalized, deduped, scored items per section. v1 ships **industry** (Google News) and **research** (arXiv); **opportunities** and **discussions** are defined and roadmapped.

`2` **Deterministic, testable core** — `fetch → normalize → dedupe → score`. The server makes no editorial judgment; that's left to the agent that drives it. 28 unit tests, and **zero real network calls in tests** (all I/O is injected).

`3` **Pluggable source adapters** — each source is one file behind a uniform `Adapter` interface. Add a feed by writing a `collect()` that returns `RadarItem[]`.

`4` **Resilient by construction** — every source failure degrades to an empty result **plus a warning**; a malformed URL or date never throws out of a run.

`5` **GitHub-native, near-zero cost** — designed to run inside GitHub Actions on a **public** repo, where Actions and Pages are free; the only metered resource is a few Copilot credits per week.

`6` **Reusable anywhere MCP runs** — drop it into Claude Desktop or any MCP client; it isn't coupled to this project.

## 🛠️ Tech Stack

- **Language / Runtime:** TypeScript 5 (strict, ESM) · Node.js ≥ 20
- **MCP:** [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol) (stdio server)
- **Parsing / validation:** [Zod](https://zod.dev) (schema & runtime validation) · [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) (Atom/RSS)
- **Tooling:** pnpm workspaces (monorepo) · [Vitest](https://vitest.dev) (tests) · [tsup](https://tsup.egoist.dev) (build)
- **Site:** [Astro 5](https://astro.build) (`femtech-radar-site`) · GitHub Pages deploy via `deploy-pages.yml`
- **Roadmap:** GitHub Agentic Workflows (`gh aw`) orchestration

## 🏗️ Architecture

<details>
<summary><kbd>System overview</kbd></summary>

```mermaid
graph TD
    subgraph Sources
      A1[arXiv API]
      A2[Google News RSS]
    end
    A1 --> AD[Source adapters<br/>normalize → RadarItem]
    A2 --> AD
    AD --> P["collect()<br/>dedupe → score → sort → since-filter"]
    P --> T[MCP tools<br/>radar_collect · radar_sources]
    T --> C[MCP clients]
    C -.roadmap.-> W[Weekly gh aw workflow]
    W -.roadmap.-> S[Astro + RSS site on GitHub Pages]
```

</details>

**Separation of determinism vs judgment:** the MCP server does only deterministic work (fetch, normalize, dedupe, score). Editorial choices — which items to feature, how to summarize — belong to the agent (`gh aw` + Copilot) that drives it. This keeps the core unit-testable and reusable.

## 🚀 Getting Started

### Prerequisites

- **Node.js ≥ 20** (the server uses global `fetch`)
- **pnpm ≥ 9** (`npm i -g pnpm`)
- _(optional)_ an MCP client such as Claude Desktop, or the `gh aw` CLI

### Installation

```bash
git clone https://github.com/ChanMeng666/femtech-radar.git
cd femtech-radar
pnpm install

# Build the MCP server
pnpm --filter @chanmeng666/femtech-radar-mcp build

# Run the test suite (28 tests)
pnpm --filter @chanmeng666/femtech-radar-mcp test
```

The built server is an executable stdio MCP server at `packages/mcp-server/dist/index.js`.

## 🛳 Project Status & Roadmap

This is the first of three planned layers (see [`docs/superpowers/specs`](docs/superpowers/specs) for the full design):

- ✅ **v1 — MCP server** *(this release)*: industry (Google News) + research (arXiv) adapters, dedupe/score pipeline, `radar_collect` / `radar_sources` tools, resilient error handling, 28 tests.
- ⏳ **v2 — orchestration**: opportunities + discussions adapters, publish to npm, a weekly `gh aw` workflow that curates a digest, ChatOps slash commands.
- 🔨 **v3 — publishing**: Astro 5 site built and CI-green; auto-deploys to GitHub Pages at https://chanmeng666.github.io/femtech-radar/ (subscribable RSS at https://chanmeng666.github.io/femtech-radar/rss.xml) once Pages is enabled.

## 📖 Usage Guide

femtech-radar is consumed as an **MCP server**. It exposes two tools:

| Tool | Parameters | Returns |
|------|------------|---------|
| `radar_collect` | `section` (`"industry"` \| `"research"` \| `"opportunities"` \| `"discussions"`), optional `since` (ISO date, default 7 days ago), optional `limit` (default 15) | `{ items: RadarItem[], warnings: string[] }` — deduped, scored, sorted, date-filtered |
| `radar_sources` | _none_ | the configured source list per section |

> In v1 only `industry` and `research` have adapters; `opportunities` and `discussions` return an empty list with a `"no adapter for …"` warning.

**Subscribe via RSS:** the weekly digest is published at [`https://chanmeng666.github.io/femtech-radar/rss.xml`](https://chanmeng666.github.io/femtech-radar/rss.xml) and works in any feed reader.

### Use with GitHub Agentic Workflows (`gh aw`)

```yaml
mcp-servers:
  femtech-radar:
    command: npx
    args: ["-y", "@chanmeng666/femtech-radar-mcp"]
```

### Use with Claude Desktop

```json
{
  "mcpServers": {
    "femtech-radar": {
      "command": "node",
      "args": ["/absolute/path/to/femtech-radar/packages/mcp-server/dist/index.js"]
    }
  }
}
```

> `npx @chanmeng666/femtech-radar-mcp` works once the package is published to npm (v2). Until then, build locally and point your client at `dist/index.js` as shown above.

See [`packages/mcp-server/README.md`](packages/mcp-server/README.md) for the full tool reference.

## ⌨️ Development

```bash
pnpm install                                              # install workspace deps
pnpm --filter @chanmeng666/femtech-radar-mcp test         # run tests (Vitest)
pnpm --filter @chanmeng666/femtech-radar-mcp build        # build with tsup
```

**Project layout**

```
packages/mcp-server/src/
├── schema.ts          # Zod RadarItem / WeeklyData (the shared data contract)
├── dedup.ts           # URL canonicalization + title-similarity dedupe
├── score.ts           # relevance × popularity × freshness scoring
├── adapters/          # one file per source (research = arXiv, industry = Google News)
├── collect.ts         # orchestration: adapter → dedupe → score → sort → since-filter
├── tools.ts           # radar_collect / radar_sources handlers
└── index.ts           # stdio MCP server entry
```

**Adding a source adapter:** implement the `Adapter` interface in `adapters/`, return `RadarItem[]` from `collect(opts)` using the injected `fetcher` (never call `fetch` directly — that keeps it testable), then wire it into `ADAPTERS` in `collect.ts`.

See [`AGENTS.md`](AGENTS.md) for AI-agent-oriented project conventions and gotchas.

## 🤝 Contributing

Contributions make the open-source community an amazing place to learn and create. Please read the
[Contributing Guide](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before you start,
and use the provided issue / pull-request templates.

## ❤️ Sponsor

If this project helps you, please consider supporting its development:

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor-GitHub-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/ChanMeng666)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/chanmeng66u)

For questions and help, see [SUPPORT.md](SUPPORT.md). For security issues, see [SECURITY.md](SECURITY.md).

## 📄 License

This project is released under the [MIT](LICENSE) license.

## 🙋‍♀️ Author

**Chan Meng**

[![Email](https://img.shields.io/badge/Email-chanmeng.dev@gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white)](mailto:chanmeng.dev@gmail.com)
[![GitHub](https://img.shields.io/badge/GitHub-ChanMeng666-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/ChanMeng666)

<div align="right">

[![](https://img.shields.io/badge/⬆%20Back%20to%20top-555?style=flat-square)](#readme-top)

</div>

<!-- Link definitions -->
[demo-link]: https://chanmeng666.github.io/femtech-radar/
[docs-link]: ./packages/mcp-server/README.md

---

<!-- CHAN MENG PERSONAL BRAND -->
<div align="center">
  <a href="https://github.com/ChanMeng666" target="_blank">
    <img src="./.github/brand/chan-meng-logo.svg" alt="Chan Meng" width="160" />
  </a>

  <p><strong>Chan Meng</strong><br/>Need a custom app like this one? I build them — let's talk.</p>

  <a href="mailto:chanmeng.dev@gmail.com"><img src="https://img.shields.io/badge/Email-chanmeng.dev@gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email Chan Meng"/></a>
  <a href="https://github.com/ChanMeng666"><img src="https://img.shields.io/badge/GitHub-ChanMeng666-181717?style=flat-square&logo=github&logoColor=white" alt="Chan Meng on GitHub"/></a>
</div>
<!-- /CHAN MENG PERSONAL BRAND -->
