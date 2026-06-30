import { z } from 'zod';
import { RadarItemSchema, Section } from '@chanmeng666/femtech-radar-mcp/schema';

export const RadarItemWithWhySchema = RadarItemSchema.extend({
  why_it_matters: z.string().optional(),
});
export type RadarItemWithWhy = z.infer<typeof RadarItemWithWhySchema>;

export const WeeklyDataWithWhySchema = z.object({
  week: z.string(),
  generated_at: z.string(),
  editor_note: z.string(),
  sections: z.object({
    industry: z.array(RadarItemWithWhySchema),
    research: z.array(RadarItemWithWhySchema),
    opportunities: z.array(RadarItemWithWhySchema),
    discussions: z.array(RadarItemWithWhySchema),
  }),
});
export type WeeklyDataWithWhy = z.infer<typeof WeeklyDataWithWhySchema>;

export const SECTION_KEYS = ['industry', 'research', 'opportunities', 'discussions'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export { Section };
