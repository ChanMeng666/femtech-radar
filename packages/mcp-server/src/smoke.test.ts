import { expect, test } from "vitest";
import { ping } from "./smoke.js";

test("ping returns pong", () => {
  expect(ping()).toBe("pong");
});
