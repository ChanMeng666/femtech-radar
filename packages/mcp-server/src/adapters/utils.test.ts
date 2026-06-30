import { expect, test } from "vitest";
import { hashId } from "./utils.js";
test("hashId is a stable 16-char hex of the url", () => {
  expect(hashId("https://x.test/a")).toMatch(/^[0-9a-f]{16}$/);
  expect(hashId("https://x.test/a")).toBe(hashId("https://x.test/a"));
  expect(hashId("https://x.test/a")).not.toBe(hashId("https://x.test/b"));
});
