# @chanmeng666/femtech-radar-mcp

An MCP (Model Context Protocol) server that fetches, deduplicates, and scores FemTech industry news and research items from public sources — ready to plug into any MCP-compatible AI client.

## Installation

No global install required. Run directly with `npx`:

```bash
npx @chanmeng666/femtech-radar-mcp
```

Requires **Node.js >= 20**.

## Usage with GitHub Actions Workflow (gh aw)

Add the following to your `mcp.json` or `mcp-servers` block:

```yaml
mcp-servers:
  femtech-radar:
    command: npx
    args: ["-y", "@chanmeng666/femtech-radar-mcp"]
```

## Usage with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "femtech-radar": {
      "command": "npx",
      "args": ["-y", "@chanmeng666/femtech-radar-mcp"]
    }
  }
}
```

## Tools

### `radar_collect`

Fetch, deduplicate, and score FemTech items for a given section and time window.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `section` | `string` | Yes | One of `"industry"`, `"research"`, `"opportunities"`, `"discussions"`. In v1 only `industry` and `research` have adapters; `opportunities` and `discussions` are valid values but return empty results with a "no adapter" warning until a later version. |
| `since`   | `string` | No | ISO 8601 date string. Defaults to 7 days ago. |
| `limit`   | `number` | No | Maximum items to return. Defaults to `15`. |

**Returns:** `{ items: RadarItem[], warnings: string[] }`

Each `RadarItem` has: `id`, `section`, `title`, `url`, `source`, `summary`, `score` (0–100), `published_at`. The `raw_metrics` field (`points`, `comments`, `citations`) is defined in the schema but is **not populated in v1** — `popularity` is always 0 and `raw_metrics` is omitted from returned items.

**Example prompt:**

> "Call `radar_collect` with section=industry to get the latest FemTech industry news."

---

### `radar_sources`

List all configured data sources grouped by section.

No parameters required.

**Returns:** `Array<{ section: string, sources: string[] }>`

**Example prompt:**

> "Call `radar_sources` to see which data sources the radar monitors."

## Data Sources (v1)

| Section | Sources |
|---------|---------|
| `industry` | Google News (RSS search) |
| `research` | arXiv API (femtech / women's-health / maternal query) |

## License

MIT
