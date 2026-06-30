export function decodeGoogleNewsURL(url: string): string {
  try {
    if (!/news\.google\.com\/(rss\/)?articles\//.test(url)) return url;
    const seg = url.split("/articles/")[1]?.split("?")[0];
    if (!seg) return url;
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(b64, "base64").toString("binary");
    const m = decoded.match(/https?:\/\/[^\x00-\x1f"'\\ ]+/);
    if (!m) return url;
    // Trim a trailing protobuf field byte if present (best-effort).
    return m[0].replace(/[\x00-\x1f].*$/, "");
  } catch {
    return url;
  }
}
