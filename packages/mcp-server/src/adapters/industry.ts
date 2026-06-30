import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import type { RadarItem } from "../schema.js";
import { scoreItem } from "../score.js";
import type { Adapter, CollectOpts } from "./types.js";

const GOOGLE_NEWS = "https://news.google.com/rss/search";
const parser = new XMLParser();

function hashId(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

export const industryAdapter: Adapter = {
  section: "industry",
  sources: ["Google News"],
  async collect({ limit, now, fetcher, keywords }: CollectOpts): Promise<RadarItem[]> {
    const url = `${GOOGLE_NEWS}?q=${encodeURIComponent("femtech OR \"women's health\"")}&hl=en-US`;
    const xml = await fetcher(url);
    const ch = parser.parse(xml)?.rss?.channel;
    const items = ch?.item ? (Array.isArray(ch.item) ? ch.item : [ch.item]) : [];
    return items.slice(0, limit).map((e: Record<string, string>): RadarItem => {
      const itemUrl = String(e.link);
      const title = String(e.title).trim();
      const summary = String(e.description ?? "").trim();
      const published_at = new Date(String(e.pubDate)).toISOString();
      return {
        id: hashId(itemUrl), section: "industry", title, url: itemUrl,
        source: "Google News", summary, published_at,
        score: scoreItem({ title, summary, popularity: 0, published_at, now, keywords }),
      };
    });
  },
};
