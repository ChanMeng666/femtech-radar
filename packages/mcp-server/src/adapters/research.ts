import { XMLParser } from "fast-xml-parser";
import type { RadarItem } from "../schema.js";
import { scoreItem } from "../score.js";
import type { Adapter, CollectOpts } from "./types.js";
import { hashId } from "./utils.js";

const ARXIV = "http://export.arxiv.org/api/query";
const parser = new XMLParser();

export const researchAdapter: Adapter = {
  section: "research",
  sources: ["arXiv"],
  async collect({ limit, now, fetcher, keywords }: CollectOpts): Promise<RadarItem[]> {
    const q = encodeURIComponent('all:femtech OR all:"women\'s health" OR all:maternal');
    const url = `${ARXIV}?search_query=${q}&sortBy=submittedDate&sortOrder=descending&max_results=${limit}`;
    const xml = await fetcher(url);
    const feed = parser.parse(xml)?.feed;
    const entries = feed?.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : [];
    return entries.map((e: Record<string, string>): RadarItem => {
      const itemUrl = String(e.id);
      const title = String(e.title).trim();
      const summary = String(e.summary ?? "").trim();
      const published_at = String(e.published);
      return {
        id: hashId(itemUrl), section: "research", title, url: itemUrl,
        source: "arXiv", summary, published_at,
        score: scoreItem({ title, summary, popularity: 0, published_at, now, keywords }),
      };
    });
  },
};
