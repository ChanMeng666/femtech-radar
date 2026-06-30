import { describe, expect, test } from "vitest";
import { safeISODate } from "./content";
describe("safeISODate", () => {
  test("formats a valid date to YYYY-MM-DD", () => { expect(safeISODate("2026-06-29T20:00:00Z")).toBe("2026-06-29"); });
  test("returns '' for an invalid date", () => { expect(safeISODate("not-a-date")).toBe(""); });
});
