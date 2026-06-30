import type { RadarItem } from "../schema.js";

export type Fetcher = (url: string) => Promise<string>;

export interface CollectOpts {
  since: Date;
  limit: number;
  now: Date;
  fetcher: Fetcher;
  keywords?: string[];
}

export interface Adapter {
  section: RadarItem["section"];
  sources: string[];
  collect(opts: CollectOpts): Promise<RadarItem[]>;
}
