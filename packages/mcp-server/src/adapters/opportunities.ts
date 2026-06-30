import type { RadarItem } from "../schema.js";
import { scoreItem } from "../score.js";
import { hashId } from "./utils.js";
import type { Adapter, CollectOpts } from "./types.js";

// ---------------------------------------------------------------------------
// Ported from D:\github_repository\linkedin-jobs-search\worker\services\linkedin.ts
// (pure, dependency-free logic only — no fetch, no pagination, no UA rotation)
// ---------------------------------------------------------------------------

// Time filter mappings
const TIME_FILTERS: Record<string, string> = {
  "past month": "r2592000",
  "past week": "r604800",
  "24hr": "r86400",
};

// Job type mappings
const JOB_TYPE_FILTERS: Record<string, string> = {
  "full time": "F",
  "full-time": "F",
  "part time": "P",
  "part-time": "P",
  contract: "C",
  temporary: "T",
  volunteer: "V",
  internship: "I",
};

// Experience level mappings
const EXPERIENCE_FILTERS: Record<string, string> = {
  internship: "1",
  "entry level": "2",
  associate: "3",
  "mid-senior level": "4",
  senior: "4",
  director: "5",
  executive: "6",
};

// Remote filter mappings
const REMOTE_FILTERS: Record<string, string> = {
  "on-site": "1",
  "on site": "1",
  remote: "2",
  hybrid: "3",
};

// Salary filter mappings
const SALARY_FILTERS: Record<string, string> = {
  "40000": "1",
  "60000": "2",
  "80000": "3",
  "100000": "4",
  "120000": "5",
};

interface Job {
  position: string;
  company: string;
  location: string;
  date: string;
  agoTime: string;
  salary: string;
  jobUrl: string;
  companyLogo?: string;
  companyUrl?: string;
}

interface QueryOptions {
  keyword?: string;
  location?: string;
  dateSincePosted?: string;
  jobType?: string;
  remoteFilter?: string;
  salary?: string;
  experienceLevel?: string;
  sortBy?: string;
  page: string;
  limit: number;
  has_verification: boolean;
  under_10_applicants: boolean;
  host: string;
}

interface TrimmedSearchParams {
  keyword?: string;
  dateSincePosted?: string;
  limit?: string | number;
}

const DEFAULTS = {
  PAGE: "0",
};

const LINKEDIN_PAGE_SIZE = 25;
const RESULTS_PER_PAGE = 12;
const MAX_RESULTS_PER_PAGE = 2 * LINKEDIN_PAGE_SIZE;

function clampLimit(limit: TrimmedSearchParams["limit"]): number {
  const n =
    typeof limit === "number" ? limit : limit ? parseInt(String(limit), 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) return RESULTS_PER_PAGE;
  return Math.min(Math.floor(n), MAX_RESULTS_PER_PAGE);
}

function buildQueryOptions(params: TrimmedSearchParams): QueryOptions {
  const { keyword, dateSincePosted, limit } = params;
  return {
    keyword,
    dateSincePosted,
    page: DEFAULTS.PAGE,
    limit: clampLimit(limit),
    has_verification: false,
    under_10_applicants: false,
    host: "www.linkedin.com",
  };
}

function buildSearchUrl(options: QueryOptions, startOverride?: number): string {
  const host = options.host || "www.linkedin.com";
  const baseUrl = `https://${host}/jobs-guest/jobs/api/seeMoreJobPostings/search`;

  const params = new URLSearchParams();

  if (options.keyword) {
    params.set("keywords", options.keyword);
  }

  if (options.location) {
    params.set("location", options.location);
  }

  const start = startOverride ?? parseInt(options.page || DEFAULTS.PAGE) * LINKEDIN_PAGE_SIZE;
  params.set("start", start.toString());

  // Time filter
  if (options.dateSincePosted && TIME_FILTERS[options.dateSincePosted.toLowerCase()]) {
    params.set("f_TPR", TIME_FILTERS[options.dateSincePosted.toLowerCase()]);
  }

  // Job type filter
  if (options.jobType && JOB_TYPE_FILTERS[options.jobType.toLowerCase()]) {
    params.set("f_JT", JOB_TYPE_FILTERS[options.jobType.toLowerCase()]);
  }

  // Experience level filter
  if (options.experienceLevel && EXPERIENCE_FILTERS[options.experienceLevel.toLowerCase()]) {
    params.set("f_E", EXPERIENCE_FILTERS[options.experienceLevel.toLowerCase()]);
  }

  // Remote filter
  if (options.remoteFilter && REMOTE_FILTERS[options.remoteFilter.toLowerCase()]) {
    params.set("f_WT", REMOTE_FILTERS[options.remoteFilter.toLowerCase()]);
  }

  // Salary filter
  if (options.salary && SALARY_FILTERS[options.salary]) {
    params.set("f_SB2", SALARY_FILTERS[options.salary]);
  }

  // Verification filter
  if (options.has_verification) {
    params.set("f_VJ", "true");
  }

  // Under 10 applicants filter
  if (options.under_10_applicants) {
    params.set("f_EA", "true");
  }

  // Sort by
  if (options.sortBy === "recent") {
    params.set("sortBy", "DD");
  } else if (options.sortBy === "relevant") {
    params.set("sortBy", "R");
  }

  return `${baseUrl}?${params.toString()}`;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function parseJobListings(html: string): Job[] {
  const jobs: Job[] = [];

  // Match job card patterns
  const jobCardRegex = /<li[^>]*>[\s\S]*?<\/li>/gi;
  const cards = html.match(jobCardRegex) || [];

  for (const card of cards) {

    try {
      // Extract job title (decode HTML entities)
      const titleMatch = card.match(/<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([^<]+)<\/h3>/i) ||
                        card.match(/<span[^>]*class="[^"]*sr-only[^"]*"[^>]*>([^<]+)<\/span>/i);
      const position = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "";

      // Extract company name (decode HTML entities)
      const companyMatch = card.match(/<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i) ||
                          card.match(/<a[^>]*class="[^"]*hidden-nested-link[^"]*"[^>]*>([^<]+)<\/a>/i);
      const company = companyMatch ? decodeHtmlEntities(companyMatch[1].trim()) : "";

      // Extract location
      const locationMatch = card.match(/<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([^<]+)<\/span>/i);
      const location = locationMatch ? locationMatch[1].trim() : "";

      // Extract job URL
      const urlMatch = card.match(/<a[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]+)"/i);
      let jobUrl = urlMatch ? urlMatch[1] : "";
      // Clean up URL (remove tracking params)
      if (jobUrl) {
        jobUrl = jobUrl.split("?")[0];
      }

      // Extract posted time
      const timeMatch = card.match(/<time[^>]*datetime="([^"]+)"[^>]*>([^<]*)<\/time>/i);
      const date = timeMatch ? timeMatch[1] : "";
      const agoTime = timeMatch ? timeMatch[2].trim() : "";

      // Extract company logo (decode HTML entities in URL)
      const logoMatch = card.match(/<img[^>]*data-delayed-url="([^"]+)"[^>]*>/i) ||
                       card.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*artdeco-entity-image[^"]*"/i);
      const companyLogo = logoMatch ? decodeHtmlEntities(logoMatch[1]) : undefined;

      // Extract company URL
      const companyUrlMatch = card.match(/<a[^>]*class="[^"]*hidden-nested-link[^"]*"[^>]*href="([^"]+)"/i);
      const companyUrl = companyUrlMatch ? companyUrlMatch[1].split("?")[0] : undefined;

      // Extract salary info
      const salaryMatch = card.match(
        /<span[^>]*class="[^"]*job-search-card__salary-info[^"]*"[^>]*>([\s\S]*?)<\/span>/i
      );
      const salary = salaryMatch ? salaryMatch[1].trim().replace(/\s+/g, ' ') : "";

      // Only add if we have minimum required fields
      if (position && company) {
        jobs.push({
          position,
          company,
          location,
          date,
          agoTime,
          salary,
          jobUrl,
          companyLogo,
          companyUrl,
        });
      }
    } catch (e) {
      console.error("Error parsing job card:", e);
    }
  }

  return jobs;
}

// ---------------------------------------------------------------------------
// SerpAPI Google Jobs path (opt-in: active only when SERP_API_KEY is set)
// ---------------------------------------------------------------------------

const SERP_QUERY = 'femtech OR "women\'s health" OR "maternal health" OR "digital health"';
const SERP_BASE = "https://serpapi.com/search";

/** Parse a relative-time string like "2 days ago" / "5 hours ago" into an ISO timestamp. */
function relativeToIso(postedAt: string, now: Date): string {
  const m = postedAt.match(/^(\d+)\s+(hour|day|week|month)s?\s+ago$/i);
  if (!m) return now.toISOString();
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const ms = { hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6 }[unit] ?? 0;
  return new Date(now.getTime() - n * ms).toISOString();
}

interface SerpJob {
  title?: string;
  company_name?: string;
  location?: string;
  description?: string;
  detected_extensions?: { posted_at?: string };
  apply_options?: Array<{ link?: string }>;
}

async function collectSerpApi({ limit, now, fetcher, keywords }: CollectOpts): Promise<RadarItem[]> {
  const apiKey = process.env.SERP_API_KEY as string;
  const url = new URL(SERP_BASE);
  url.searchParams.set("engine", "google_jobs");
  url.searchParams.set("q", SERP_QUERY);
  url.searchParams.set("chips", "date_posted:week");
  url.searchParams.set("hl", "en");
  url.searchParams.set("api_key", apiKey);

  const raw = JSON.parse(await fetcher(url.toString())) as { jobs_results?: SerpJob[] };
  const jobs: SerpJob[] = (raw.jobs_results ?? []).filter(j => !!(j.apply_options?.[0]?.link));

  return jobs.slice(0, limit).map((j): RadarItem => {
    const jobUrl = j.apply_options?.[0]?.link ?? "";
    const title = j.title ?? "";
    const desc = (j.description ?? "").slice(0, 200);
    const summary = [j.company_name, j.location, desc].filter(Boolean).join(" · ");
    const published_at = j.detected_extensions?.posted_at
      ? relativeToIso(j.detected_extensions.posted_at, now)
      : now.toISOString();
    return {
      id: hashId(jobUrl),
      section: "opportunities",
      title,
      url: jobUrl,
      source: "Google Jobs",
      summary,
      score: scoreItem({ title, summary, popularity: 0, published_at, now, keywords }),
      published_at,
    };
  });
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

const LINKEDIN_QUERY = 'femtech OR "women\'s health" OR "maternal health" OR "digital health"';
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function collectLinkedIn({ limit, now, fetcher, keywords }: CollectOpts): Promise<RadarItem[]> {
  const url = buildSearchUrl(buildQueryOptions({ keyword: LINKEDIN_QUERY, dateSincePosted: "past week", limit }));
  const html = await fetcher(url, { headers: { "user-agent": BROWSER_UA, "accept": "text/html" } });
  const jobs = parseJobListings(html).filter(j => !!j.jobUrl);
  return jobs.slice(0, limit).map((j): RadarItem => {
    const summary = [j.company, j.location, j.salary].filter(Boolean).join(" · ");
    const d = new Date(j.date);
    const published_at = j.date && !Number.isNaN(d.getTime()) ? d.toISOString() : now.toISOString();
    return {
      id: hashId(j.jobUrl), section: "opportunities", title: j.position, url: j.jobUrl,
      source: "LinkedIn", summary,
      score: scoreItem({ title: j.position, summary, popularity: 0, published_at, now, keywords }),
      published_at,
    };
  });
}

export const opportunitiesAdapter: Adapter = {
  section: "opportunities",
  sources: ["LinkedIn", "Google Jobs"],
  async collect(opts: CollectOpts): Promise<RadarItem[]> {
    return process.env.SERP_API_KEY ? collectSerpApi(opts) : collectLinkedIn(opts);
  },
};
