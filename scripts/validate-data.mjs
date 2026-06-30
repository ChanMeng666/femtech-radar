import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { WeeklyDataSchema } from "@chanmeng666/femtech-radar-mcp/schema";

export function validateData(obj) {
  const r = WeeklyDataSchema.safeParse(obj);
  if (r.success) return { ok: true };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}

export function validateDataFile(path) {
  return validateData(JSON.parse(readFileSync(path, "utf8")));
}

// CLI: validate every data/*.json (cross-platform main-module check)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
