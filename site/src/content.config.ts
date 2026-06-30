import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { WeeklyDataWithWhySchema } from './lib/schema';

const radar = defineCollection({
  loader: glob({ pattern: '**/*.json', base: '../data' }),
  schema: WeeklyDataWithWhySchema,
});

export const collections = { radar };
