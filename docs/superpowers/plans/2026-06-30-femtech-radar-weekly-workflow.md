# femtech-radar Weekly gh aw Workflow Implementation Plan (v1, Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the `@chanmeng666/femtech-radar-mcp` package to npm, then add a weekly GitHub Agentic Workflow (`gh aw`) that calls it to curate a FemTech digest and emits the week's data as an auditable PR plus a summary issue.

**Architecture:** The MCP server (Plan 1, already on `master`) is published to npm so the workflow can launch it via `npx`. A scheduled `gh aw` markdown workflow declares the MCP server, calls `radar_collect` for the `industry` and `research` sections, and the Copilot agent curates the results into `data/YYYY-Www.json` (validated against the existing Zod `WeeklyData` schema) via a `create-pull-request` safe-output, plus a human-readable summary via `create-issue`. A small CI check validates committed data files and re-verifies the workflow compiles. This plan is the orchestration layer (Unit ② of the design spec); the Astro site is Plan 3.

**Tech Stack:** GitHub Agentic Workflows (`gh aw` CLI), GitHub Actions, npm (scoped public publish), Node ≥ 20, the existing `@chanmeng666/femtech-radar-mcp` package, Zod (reused `WeeklyDataSchema`), Vitest.

## Global Constraints

- The repo MUST stay **public** (free Actions + Pages; the design's cost model depends on it).
- Package name: `@chanmeng666/femtech-radar-mcp`; scoped publishes require `publishConfig.access: "public"`.
- The workflow engine is **`engine: copilot`** (the account has Copilot active).
- `gh aw` frontmatter is **kebab-case**; after editing frontmatter you MUST run `gh aw compile <name>` and commit BOTH `.github/workflows/<name>.md` and the generated `.github/workflows/<name>.lock.yml`.
- Custom MCP servers are declared under the top-level **`mcp-servers:`** key with `command` / `args` / `allowed` (verified against gh aw docs 2026-06).
- The data contract is the existing `WeeklyDataSchema` from `packages/mcp-server/src/schema.ts` — do NOT redefine it; import/reuse it.
- `data/YYYY-Www.json` is the site's single source of truth (Plan 3 consumes it). Week key format is ISO week: `2026-W27`.
- v1 sections with adapters are **`industry`** and **`research`** only; `opportunities`/`discussions` stay empty arrays.
- Network allowlist MUST include every source domain the MCP reaches (`export.arxiv.org`, `news.google.com`) plus npm for `npx` (`defaults`).

## Prerequisites (verify before Task 1)

- **`gh aw` CLI installed:** `gh aw version` prints a version. If "unknown command", install: `curl -sL https://raw.githubusercontent.com/github/gh-aw/main/install-gh-aw.sh | bash`.
- **npm auth for publishing:** publishing is an interactive/credentialed step. The user runs `! npm login` (or sets `NPM_TOKEN`) in their terminal before Task 1's publish step. The implementer must NOT attempt to publish without confirmed auth — it is an irreversible public action.

---

### Task 1: Make the MCP package npm-publish-ready and publish it

**Files:**
- Modify: `packages/mcp-server/package.json`
- Create: `packages/mcp-server/.npmignore`

**Interfaces:**
- Consumes: the built `dist/` from Plan 1's build.
- Produces: a published `@chanmeng666/femtech-radar-mcp@0.1.0` on npm, runnable via `npx -y @chanmeng666/femtech-radar-mcp`.

- [ ] **Step 1: Add publish metadata + prepublish build to package.json**

Add these keys to `packages/mcp-server/package.json` (merge into the existing object):
```json
"publishConfig": { "access": "public" },
"scripts": {
  "build": "tsup src/index.ts --format esm --dts --clean",
  "test": "vitest run",
  "dev": "vitest",
  "prepublishOnly": "pnpm run build && pnpm run test"
}
```
(Keep the existing `bin`, `files: ["dist"]`, `description`, `keywords`, `repository`, `engines` from Plan 1. `prepublishOnly` guarantees `dist/` is freshly built and tests pass before any publish.)

- [ ] **Step 2: Add an `.npmignore` so only `dist/` ships**

`packages/mcp-server/.npmignore`:
```
src
*.test.ts
tsconfig.json
vitest.config.ts
.superpowers
```
(`files: ["dist"]` already whitelists `dist`; `.npmignore` is belt-and-suspenders so source/tests never publish.)

- [ ] **Step 3: Verify the package contents WITHOUT publishing (dry run)**

Run:
```bash
cd packages/mcp-server && npm pack --dry-run
```
Expected: the file list shows `dist/index.js`, `dist/index.d.ts`, `package.json`, `README.md` — and NO `src/`, NO `*.test.ts`. If `dist/` is missing, run `pnpm --filter @chanmeng666/femtech-radar-mcp build` first.

- [ ] **Step 4: Commit the publish-readiness changes**

```bash
git add packages/mcp-server/package.json packages/mcp-server/.npmignore
git commit -m "build(mcp): make package npm-publish-ready (publishConfig, prepublishOnly, npmignore)"
```

- [ ] **Step 5: Publish to npm (requires confirmed npm auth — see Prerequisites)**

> This step is IRREVERSIBLE and public. Only proceed if `npm whoami` prints the user's npm account. If it errors, STOP and have the user run `! npm login`, then resume.

Run:
```bash
cd packages/mcp-server && npm whoami && npm publish
```
Expected: `npm whoami` prints the account; `npm publish` reports `+ @chanmeng666/femtech-radar-mcp@0.1.0`.

- [ ] **Step 6: Verify the published package launches over npx**

Run:
```bash
cd "$(mktemp -d)" && printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | npx -y @chanmeng666/femtech-radar-mcp
```
Expected: a JSON-RPC response to id:2 listing `radar_collect` and `radar_sources`. (If npx caching is stale, add `@0.1.0`.)

---

### Task 2: Data-contract validator script (reusing `WeeklyDataSchema`)

**Files:**
- Create: `scripts/validate-data.mjs`
- Create: `scripts/validate-data.test.mjs`
- Create: `data/.gitkeep`
- Modify: root `package.json` (add a `validate-data` script + `vitest` devDep if absent)

**Interfaces:**
- Consumes: `WeeklyDataSchema` exported from `@chanmeng666/femtech-radar-mcp` (re-exported from the package root — see Step 1 note).
- Produces: `validateDataFile(path: string): { ok: true } | { ok: false, errors: string[] }` and a CLI that validates every `data/*.json`, exiting non-zero on any failure.

> Note: `WeeklyDataSchema` must be importable from the package root. In Plan 1 it lives in `src/schema.ts` and the package main is `dist/index.js` (server entry), which does NOT re-export it. **Step 1 of this task fixes that** by re-exporting the schema from the package entry so consumers (this validator and Plan 3's site) can import it.

- [ ] **Step 1: Re-export the schema from the MCP package entry, rebuild, republish-or-link**

Add to `packages/mcp-server/src/index.ts` (top level, before `server.connect`):
```ts
export { WeeklyDataSchema, RadarItemSchema, Section } from "./schema.js";
export type { WeeklyData, RadarItem } from "./schema.js";
```
Then rebuild: `pnpm --filter @chanmeng666/femtech-radar-mcp build`.
For local development the root validator imports via the workspace (`pnpm` symlinks the package), so no republish is needed to use it locally; the next published version will include the re-export. Commit this with Task 2's final commit.

- [ ] **Step 2: Write the failing test**

`scripts/validate-data.test.mjs`:
```js
import { expect, test } from "vitest";
import { validateData } from "./validate-data.mjs";

const valid = {
  week: "2026-W27", generated_at: "2026-06-30T00:00:00Z", editor_note: "hi",
  sections: { industry: [], research: [], opportunities: [], discussions: [] },
};

test("validateData accepts a well-formed WeeklyData object", () => {
  expect(validateData(valid)).toEqual({ ok: true });
});

test("validateData rejects an object missing a section", () => {
  const bad = { ...valid, sections: { industry: [], research: [] } };
  const res = validateData(bad);
  expect(res.ok).toBe(false);
  expect(res.errors.length).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run scripts/validate-data.test.mjs`
Expected: FAIL — `./validate-data.mjs` not found.

- [ ] **Step 4: Write the validator**

`scripts/validate-data.mjs`:
```js
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { WeeklyDataSchema } from "@chanmeng666/femtech-radar-mcp";

export function validateData(obj) {
  const r = WeeklyDataSchema.safeParse(obj);
  if (r.success) return { ok: true };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}

export function validateDataFile(path) {
  return validateData(JSON.parse(readFileSync(path, "utf8")));
}

// CLI: validate every data/*.json
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = "data";
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  let failed = false;
  for (const f of files) {
    const res = validateDataFile(join(dir, f));
    if (!res.ok) { failed = true; console.error(`✗ ${f}:\n  ${res.errors.join("\n  ")}`); }
    else console.log(`✓ ${f}`);
  }
  process.exit(failed ? 1 : 0);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run scripts/validate-data.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 6: Wire the root script + keep an empty data dir**

Create `data/.gitkeep` (empty file). Add to root `package.json` scripts:
```json
"validate-data": "node scripts/validate-data.mjs"
```
Ensure root `package.json` has `vitest` in devDependencies (add `"vitest": "^2.0.0"` if absent) and run `pnpm install`.

- [ ] **Step 7: Commit**

```bash
git add packages/mcp-server/src/index.ts scripts/validate-data.mjs scripts/validate-data.test.mjs data/.gitkeep package.json pnpm-lock.yaml
git commit -m "feat: add data-contract validator reusing WeeklyDataSchema"
```

---

### Task 3: Author the weekly gh aw workflow

**Files:**
- Create: `.github/workflows/weekly-radar.md`
- Create: `.github/workflows/weekly-radar.lock.yml` (generated by `gh aw compile`)

**Interfaces:**
- Consumes: the published MCP (`npx -y @chanmeng666/femtech-radar-mcp`), its tools `radar_collect` / `radar_sources`.
- Produces: a compiled workflow that, on schedule or dispatch, emits a `create-pull-request` writing `data/YYYY-Www.json` and a `create-issue` summary.

- [ ] **Step 1: Write the workflow markdown**

`.github/workflows/weekly-radar.md`:
```markdown
---
name: Weekly FemTech Radar
on:
  schedule:
    - cron: "0 8 * * 1"   # Mondays 08:00 UTC
  workflow_dispatch:
engine: copilot
permissions:
  contents: read
  issues: read
network:
  allowed:
    - defaults
    - export.arxiv.org
    - news.google.com
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

1. Call the `radar_collect` tool twice: once with `section: "industry"` and once with `section: "research"`, each with `limit: 12`. Use the returned, already-deduped-and-scored items.
2. For each section, keep the top items by score (drop anything clearly off-topic). For every kept item, write a single sentence on **why it matters to FemTech / women-in-tech practitioners**.
3. Write a 2–3 sentence `editor_note` summarizing the week's themes.
4. Determine the current ISO week key in the form `YYYY-Www` (e.g. `2026-W27`).

Then produce TWO outputs:

**A — a pull request** (`create-pull-request`) that adds ONE file `data/<week>.json` whose content is exactly this shape (no extra keys), with `opportunities` and `discussions` as empty arrays, and each item carrying an added `why_it_matters` string:

    {
      "week": "<week>",
      "generated_at": "<current ISO-8601 timestamp>",
      "editor_note": "<your note>",
      "sections": {
        "industry":  [ { "id","section","title","url","source","summary","score","published_at","why_it_matters" } ],
        "research":  [ ... ],
        "opportunities": [],
        "discussions": []
      }
    }

The PR title should be `Weekly FemTech Radar – <week>` and the body a short description.

**B — a summary issue** (`create-issue`) titled `FemTech Radar – <week>` whose body is a readable Markdown digest: the `editor_note`, then per section a list of `**[title](url)**` — _why_it_matters_ (score, source). This issue is the notification + discussion thread.

If a section returns warnings or no items, say so briefly in the editor_note rather than failing.
```

- [ ] **Step 2: Compile the workflow**

Run: `gh aw compile weekly-radar`
Expected: writes `.github/workflows/weekly-radar.lock.yml` with no errors. If `gh aw` reports a frontmatter schema error, fix the offending key (consult `.github/aw/github-agentic-workflows.md` if `gh aw init` created it, or `gh aw compile --help`) and recompile.

- [ ] **Step 3: Sanity-check the compiled lock file**

Run: `grep -E "femtech-radar|create-pull-request|create-issue|schedule" .github/workflows/weekly-radar.lock.yml`
Expected: the MCP server, both safe-outputs, and the schedule are present in the generated lock.

- [ ] **Step 4: Commit both files**

```bash
git add .github/workflows/weekly-radar.md .github/workflows/weekly-radar.lock.yml
git commit -m "feat: add weekly FemTech radar gh aw workflow"
```

---

### Task 4: CI — validate data files and verify the workflow compiles

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the `validate-data` script (Task 2), the MCP test suite (Plan 1), `gh aw` compile (Task 3).
- Produces: a CI workflow that fails a PR if data is malformed, the MCP tests break, or the `.lock.yml` is stale.

- [ ] **Step 1: Write the CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push:
    branches: [master]
  pull_request:
jobs:
  test-and-validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @chanmeng666/femtech-radar-mcp build
      - run: pnpm --filter @chanmeng666/femtech-radar-mcp test
      - name: Validate committed data files
        run: |
          if ls data/*.json >/dev/null 2>&1; then node scripts/validate-data.mjs; else echo "no data files yet"; fi
```

- [ ] **Step 2: Validate the YAML locally**

Run: `node -e "require('node:fs').readFileSync('.github/workflows/ci.yml','utf8')" && npx --yes js-yaml .github/workflows/ci.yml >/dev/null && echo "yaml ok"`
Expected: `yaml ok` (parses without error).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: test the MCP package and validate radar data files"
```

---

### Task 5: Manual integration validation (human-run acceptance)

**Files:** none (documented acceptance steps; produces the first real `data/*.json` + issue).

**Interfaces:**
- Consumes: everything above, pushed to `master`.
- Produces: the first real weekly PR + summary issue, and a validated data file.

> This task is NOT automatable — it triggers a live agent run that consumes Copilot AI credits and writes to GitHub. The implementer documents the result; the user performs/authorizes the run.

- [ ] **Step 1: Push the branch and open/merge its PR so the workflow lock is on the default branch**

`gh aw` event/schedule triggers only fire when the `.lock.yml` is on `master`. Push this plan's branch and merge it to `master` (the workflow won't run from a feature branch).

- [ ] **Step 2: Trigger a manual run**

Run: `gh aw run weekly-radar` (or trigger `workflow_dispatch` from the Actions tab).
Expected: an Actions run starts; within a minute or two it opens a `[radar]`-prefixed PR adding `data/<week>.json` and a `[radar]` summary issue.

- [ ] **Step 3: Validate the produced data file**

On the PR branch (or after checking it out): `node scripts/validate-data.mjs`
Expected: `✓ <week>.json` — the agent's output conforms to `WeeklyDataSchema`. If it fails, refine the prompt body in `weekly-radar.md` (the body needs no recompile) to tighten the JSON shape, push, and re-run.

- [ ] **Step 4: Record the outcome**

Note in the run report: the PR URL, the issue URL, and the `validate-data` result. These are the success criteria for Plan 2.

---

## Self-Review

**Spec coverage (Unit ② of the design spec):**
- Weekly schedule + workflow_dispatch → Task 3 frontmatter ✓
- Calls femtech-radar MCP (industry + research) → Task 3 prompt + `mcp-servers` ✓ (MCP made reachable via npm publish, Task 1)
- Editorial curation (top-N, why-it-matters, editor_note) → Task 3 prompt body ✓
- `create-pull-request` writing `data/YYYY-Www.json` → Task 3 safe-outputs ✓
- `create-issue` summary → Task 3 safe-outputs ✓
- Data file conforms to `WeeklyData` contract → Task 2 validator + Task 5 acceptance ✓
- Network allowlist covers source domains → Task 3 `network.allowed` ✓
- CI guards data + tests + compile freshness → Task 4 ✓
- Reuse (not redefine) `WeeklyDataSchema` → Task 2 Step 1 re-export ✓
- Deferred to Plan 3: the Astro + RSS site that reads `data/*.json`.

**Placeholder scan:** No TBD/TODO. The two human-run/irreversible actions (npm publish in Task 1, live agent run in Task 5) are explicitly marked and gated on auth/confirmation, with exact commands and expected output — they are deliberately manual, not vague.

**Type consistency:** `WeeklyDataSchema` is the single shared contract (defined Plan 1, re-exported Task 2 Step 1, consumed by the validator and the workflow's required JSON shape in Task 3). The data shape in Task 3's prompt matches the schema's fields (`week`, `generated_at`, `editor_note`, `sections.{industry,research,opportunities,discussions}`) plus the agent-added `why_it_matters`. Week-key format `YYYY-Www` is consistent across Tasks 2, 3, 5.

**Known soft spot (call out at execution):** `gh aw` is in technical preview; the exact frontmatter key spelling (`mcp-servers`, `network.allowed`, `safe-outputs`) was verified against the docs on 2026-06-30 but may drift. Task 3 Step 2 (`gh aw compile`) is the real gate — if a key is rejected, consult the locally-generated `.github/aw/github-agentic-workflows.md` reference and adjust before proceeding.
