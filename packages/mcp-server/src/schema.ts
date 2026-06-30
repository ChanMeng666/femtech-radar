import { z } from "zod";

export const Section = z.enum(["industry", "research", "opportunities", "discussions"]);
export type Section = z.infer<typeof Section>;

export const RadarItemSchema = z.object({
  id: z.string(),
  section: Section,
  title: z.string(),
  url: z.string().url(),
  source: z.string(),
  summary: z.string(),
  score: z.number().min(0).max(100),
  published_at: z.string(),
  raw_metrics: z
    .object({ points: z.number().optional(), comments: z.number().optional(), citations: z.number().optional() })
    .optional(),
});
export type RadarItem = z.infer<typeof RadarItemSchema>;

export const WeeklyDataSchema = z.object({
  week: z.string(),
  generated_at: z.string(),
  editor_note: z.string(),
  sections: z.object({
    industry: z.array(RadarItemSchema),
    research: z.array(RadarItemSchema),
    opportunities: z.array(RadarItemSchema),
    discussions: z.array(RadarItemSchema),
  }),
});
export type WeeklyData = z.infer<typeof WeeklyDataSchema>;
