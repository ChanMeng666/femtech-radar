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
