import type { SectionKey } from './schema';

export interface ConfiguredSource {
  section: SectionKey;
  name: string;
  detail: string;
  status: 'live' | 'planned';
}

// Snapshot of the MCP server's radar_sources output (v1 adapters).
export const CONFIGURED_SOURCES: ConfiguredSource[] = [
  { section: 'industry', name: 'Google News', detail: 'FemTech / women’s-health news query (RSS).', status: 'live' },
  { section: 'research', name: 'arXiv', detail: 'q-bio / cs.CY + women’s-health keyword search.', status: 'live' },
  { section: 'opportunities', name: 'LinkedIn', detail: 'Women-in-tech / FemTech job postings (LinkedIn guest search).', status: 'live' },
  { section: 'discussions', name: 'Hacker News', detail: 'FemTech / women-in-tech discussion (HN Algolia search).', status: 'live' },
];
