import { expect, test } from "vitest";
import { decodeGoogleNewsURL } from "./gnews-url.js";

// Older decodable form: base64 of a payload that contains the publisher URL.
const payload = Buffer.from(
  "\x08\x13\x22" + "https://example.com/real-article" + "\x01"
).toString("base64").replace(/=+$/, "");

test("decodes an embedded publisher URL from a CBMi-style path", () => {
  const u = `https://news.google.com/rss/articles/${payload}?oc=5`;
  expect(decodeGoogleNewsURL(u)).toBe("https://example.com/real-article");
});
test("returns the original url unchanged when not decodable", () => {
  const opaque = "https://news.google.com/rss/articles/CBMiABC123_not_base64_$$?oc=5";
  expect(decodeGoogleNewsURL(opaque)).toBe(opaque);
});
test("passes through non-google-news urls", () => {
  expect(decodeGoogleNewsURL("https://arxiv.org/abs/1")).toBe("https://arxiv.org/abs/1");
});
