import type { RadarItem } from "../schema.js";
import { scoreItem } from "../score.js";
import { hashId } from "./utils.js";
import type { Adapter, CollectOpts, Fetcher } from "./types.js";

// Hacker News Algolia has NO boolean OR / phrase operators in `query` — it does a
// single full-text match over all tokens. So run one query per term and merge.
const HN = "https://hn.algolia.com/api/v1/search_by_date";
const HN_TERMS = ["femtech", "women's health", "menstrual", "fertility", "menopause"];

// Mastodon public hashtag timelines are keyless and carry recent, on-topic posts.
const MASTODON = "https://mastodon.social/api/v1/timelines/tag";
const MASTODON_TAGS = ["femtech", "WomenInTech", "womenshealth"];

const UA = "Mozilla/5.0 (compatible; femtech-radar/1.0)";

function stripHtml(input: string): string {
  return String(input)
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(input: string, max: number): string {
  return input.length <= max ? input : input.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

// Fetch + parse JSON through the injected fetcher; a failing source yields null
// (per-source graceful degradation — one dead source never zeroes the section).
async function fetchJson(fetcher: Fetcher, url: string): Promise<unknown> {
  try {
    return JSON.parse(await fetcher(url, { headers: { "user-agent": UA } }));
  } catch {
    return null;
  }
}

async function collectHackerNews(opts: CollectOpts): Promise<RadarItem[]> {
  const { limit, now, fetcher, keywords } = opts;
  const items: RadarItem[] = [];
  for (const term of HN_TERMS) {
    const url = `${HN}?query=${encodeURIComponent(term)}&tags=story&hitsPerPage=${limit}`;
    const data = (await fetchJson(fetcher, url)) as { hits?: unknown[] } | null;
    const hits: any[] = Array.isArray(data?.hits) ? data!.hits! : [];
    for (const h of hits) {
      const itemUrl = h.url ?? (h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : "");
      if (!itemUrl) continue;
      const title = String(h.title ?? "");
      const summary = `${h.points ?? 0} points · ${h.num_comments ?? 0} comments on Hacker News`;
      const published_at = String(h.created_at ?? now.toISOString());
      items.push({
        id: hashId(itemUrl),
        section: "discussions",
        title,
        url: itemUrl,
        source: "Hacker News",
        summary,
        published_at,
        score: scoreItem({ title, summary, popularity: Number(h.points ?? 0), published_at, now, keywords }),
        raw_metrics: { points: Number(h.points ?? 0), comments: Number(h.num_comments ?? 0) },
      });
    }
  }
  return items;
}

async function collectMastodon(opts: CollectOpts): Promise<RadarItem[]> {
  const { now, fetcher, keywords } = opts;
  const items: RadarItem[] = [];
  for (const tag of MASTODON_TAGS) {
    const url = `${MASTODON}/${encodeURIComponent(tag)}?limit=20`;
    const data = await fetchJson(fetcher, url);
    const posts: any[] = Array.isArray(data) ? data : [];
    for (const p of posts) {
      const itemUrl = p.url ?? p.uri ?? "";
      if (!itemUrl) continue;
      const text = stripHtml(p.content ?? "");
      if (!text) continue;
      const acct = p.account?.acct ? `@${p.account.acct}` : "someone";
      const summary = `${acct} on Mastodon · ${p.favourites_count ?? 0} favourites · ${p.replies_count ?? 0} replies`;
      const published_at = String(p.created_at ?? now.toISOString());
      items.push({
        id: hashId(itemUrl),
        section: "discussions",
        title: truncate(text, 120),
        url: itemUrl,
        source: "Mastodon",
        summary,
        // Score against the full post text so short-but-relevant toots still surface.
        score: scoreItem({ title: text, summary, popularity: Number(p.favourites_count ?? 0), published_at, now, keywords }),
        published_at,
        raw_metrics: { points: Number(p.favourites_count ?? 0), comments: Number(p.replies_count ?? 0) },
      });
    }
  }
  return items;
}

export const discussionsAdapter: Adapter = {
  section: "discussions",
  sources: ["Hacker News", "Mastodon"],
  async collect(opts: CollectOpts): Promise<RadarItem[]> {
    const [hn, mastodon] = await Promise.all([collectHackerNews(opts), collectMastodon(opts)]);
    // De-duplicate by URL (the multi-term/multi-tag queries can overlap).
    const seen = new Set<string>();
    return [...hn, ...mastodon].filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)));
  },
};
