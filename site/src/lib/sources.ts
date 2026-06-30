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
  { section: 'opportunities', name: '—', detail: 'No adapter yet; arriving in v2.', status: 'planned' },
  { section: 'discussions', name: '—', detail: 'No adapter yet; arriving in v2.', status: 'planned' },
];
