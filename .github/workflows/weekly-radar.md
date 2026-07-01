---
name: Weekly FemTech Radar
on:
  schedule:
    - cron: "0 8 * * 1"   # Mondays 08:00 UTC
  workflow_dispatch:
engine:
  id: copilot
  model: gpt-4.1
permissions:
  contents: read
  issues: read
network:
  allowed:
    - defaults
    - export.arxiv.org
    - news.google.com
    - www.linkedin.com
    - hn.algolia.com
    - serpapi.com
    - mastodon.social
mcp-servers:
  femtech-radar:
    command: npx
    args: ["-y", "@chanmeng666/femtech-radar-mcp"]
    allowed: ["radar_collect", "radar_sources"]
safe-outputs:
  create-pull-request:
    title-prefix: "[radar] "
    labels: [femtech-radar, automated]
    max: 1
  create-issue:
    title-prefix: "[radar] "
    labels: [femtech-radar, digest]
    max: 1
---

# Weekly FemTech Radar

You are the editor of a weekly FemTech intelligence digest. Today is the start of a new ISO week.

1. Call the `radar_collect` tool four times — once each for `section: "industry"`, `section: "research"`, `section: "opportunities"`, and `section: "discussions"` — each with `limit: 12`. Use the returned, already-deduped-and-scored items.
2. For each section, keep the top items by score (drop anything clearly off-topic). For every kept item, write a single sentence on **why it matters to FemTech / women-in-tech practitioners**.
3. Write a 2–3 sentence `editor_note` summarizing the week's themes.
4. Determine the current ISO week key in the form `YYYY-Www` (e.g. `2026-W27`).

Then produce TWO outputs:

**A — a pull request** (`create-pull-request`) that adds ONE file `data/<week>.json` whose content is exactly this shape (no extra keys), with each item carrying an added `why_it_matters` string:

    {
      "week": "<week>",
      "generated_at": "<current ISO-8601 timestamp>",
      "editor_note": "<your note>",
      "sections": {
        "industry":      [ { "id","section","title","url","source","summary","score","published_at","why_it_matters" } ],
        "research":      [ { "id","section","title","url","source","summary","score","published_at","why_it_matters" } ],
        "opportunities": [ { "id","section","title","url","source","summary","score","published_at","why_it_matters" } ],
        "discussions":   [ { "id","section","title","url","source","summary","score","published_at","why_it_matters" } ]
      }
    }

The PR title should be `Weekly FemTech Radar – <week>` and the body a short description.

**B — a summary issue** (`create-issue`) titled `FemTech Radar – <week>` whose body is a readable Markdown digest: the `editor_note`, then per section a list of `**[title](url)**` — _why_it_matters_ (score, source). This issue is the notification + discussion thread.

If a section returns warnings or no items, say so briefly in the editor_note rather than failing.

<!-- SerpAPI opt-in (Google Jobs for opportunities section):
     By default the opportunities adapter uses LinkedIn Jobs via the MCP server's built-in scraper.
     To also enable the SerpAPI Google Jobs path, do TWO things:
     1. Add a repo secret named SERP_API_KEY (Settings → Secrets and variables → Actions → New repository secret).
     2. Add an env block under the femtech-radar mcp-server entry in this file's frontmatter, e.g.
        (replace the literal placeholder with the real GitHub Actions expression ${ { secrets.SERP_API_KEY } }):
          mcp-servers:
            femtech-radar:
              command: npx
              args: ["-y", "@chanmeng666/femtech-radar-mcp"]
              allowed: ["radar_collect", "radar_sources"]
              env:
                SERP_API_KEY: "<your-secrets-expression>"
     Do NOT add the env block until the secret exists — an undefined secret resolves to an empty string
     which is harmless, but keeping the config clean avoids confusion.
-->
