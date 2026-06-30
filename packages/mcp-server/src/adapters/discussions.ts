import type { RadarItem } from "../schema.js";
import { scoreItem } from "../score.js";
import { hashId } from "./utils.js";
import type { Adapter, CollectOpts } from "./types.js";

const HN = "https://hn.algolia.com/api/v1/search_by_date";
const HN_QUERY = 'femtech OR "women\'s health" OR "women in tech"';

export const discussionsAdapter: Adapter = {
  section: "discussions",
  sources: ["Hacker News"],
  async collect({ limit, now, fetcher, keywords }: CollectOpts): Promise<RadarItem[]> {
    const url = `${HN}?query=${encodeURIComponent(HN_QUERY)}&tags=story&hitsPerPage=${limit}`;
    const data = JSON.parse(await fetcher(url));
    const hits: any[] = Array.isArray(data?.hits) ? data.hits : [];
    return hits.slice(0, limit).map((h): RadarItem => {
      const itemUrl = h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`;
      const summary = `${h.points ?? 0} points · ${h.num_comments ?? 0} comments on Hacker News`;
      const published_at = String(h.created_at);
      return {
        id: hashId(itemUrl), section: "discussions", title: String(h.title ?? ""), url: itemUrl,
        source: "Hacker News", summary, published_at,
        score: scoreItem({ title: String(h.title ?? ""), summary, popularity: Number(h.points ?? 0), published_at, now, keywords }),
        raw_metrics: { points: Number(h.points ?? 0), comments: Number(h.num_comments ?? 0) },
      };
    });
  },
};
