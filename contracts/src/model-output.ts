import { z } from 'zod';
import { SectionKey } from './sections';
import { Slot } from './edition';

export const Candidate = z.object({
  id: z.string().regex(/^c\d{3,}$/),
  sourceKey: z.string(),
  publisher: z.string(),
  sectionHint: SectionKey,
  title: z.string(),
  snippet: z.string(),
  url: z.string().url(),
  publishedAt: z.string().datetime({ offset: true }),
});
export type Candidate = z.infer<typeof Candidate>;

export const CandidatesFile = z.object({
  slot: Slot,
  editionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedAt: z.string().datetime({ offset: true }),
  amContext: z.object({ createdAt: z.string().datetime({ offset: true }), titles: z.array(z.string()) }).nullable(),
  candidates: z.array(Candidate),
});
export type CandidatesFile = z.infer<typeof CandidatesFile>;

export const ModelStory = z.object({
  section: SectionKey,
  title: z.string(),
  summary: z.string(),
  whyItMatters: z.string(),
  pickedBecause: z.string(),
  articleIds: z.array(z.string()).min(1),
});
export type ModelStory = z.infer<typeof ModelStory>;

export const ModelEdition = z.object({
  stories: z.array(ModelStory),
  top3: z.array(z.number().int().min(0)).nullable(),
  nudge: z.string().nullable(),
});
export type ModelEdition = z.infer<typeof ModelEdition>;
