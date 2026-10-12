import { z } from 'zod';
import { SectionKey } from './sections';

const isoDateTime = z.string().datetime({ offset: true });
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const StoryLink = z.object({
  sourceKey: z.string().min(1),
  url: z.string().url(),
  publisherTitle: z.string().min(1),
  publishedAt: isoDateTime,
});
export type StoryLink = z.infer<typeof StoryLink>;

export const Story = z.object({
  id: z.string().min(1),
  section: SectionKey,
  rank: z.number().int().min(1),
  topRank: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  title: z.string().min(1),
  summary: z.string().min(1),
  whyItMatters: z.string().min(1),
  pickedBecause: z.string().min(1),
  links: z.array(StoryLink).min(1),
});
export type Story = z.infer<typeof Story>;

export const WeatherPlace = z.object({
  name: z.string(),
  nowC: z.number(),
  highC: z.number(),
  lowC: z.number(),
  normalHighC: z.number(),
  normalLowC: z.number(),
  summary: z.string(),
  rainChancePct: z.number().min(0).max(100),
  windKmh: z.number().min(0),
  sunrise: z.string().regex(/^\d{2}:\d{2}$/),
  hourly: z.array(z.object({ time: z.string().regex(/^\d{2}:\d{2}$/), tempC: z.number() })),
});
export type WeatherPlace = z.infer<typeof WeatherPlace>;

export const Weather = z.object({ katoomba: WeatherPlace, sydney: WeatherPlace });
export type Weather = z.infer<typeof Weather>;

export const KeyDate = z.object({
  date: localDate,
  timeLocal: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  label: z.string().min(1),
  sourceName: z.string().min(1),
  url: z.string().url(),
});
export type KeyDate = z.infer<typeof KeyDate>;

export const Slot = z.enum(['am', 'pm']);
export type Slot = z.infer<typeof Slot>;

export const EditionStatus = z.enum(['ok', 'partial', 'failed']);
export type EditionStatus = z.infer<typeof EditionStatus>;

export const Edition = z.object({
  id: z.string().min(1),
  editionDate: localDate,
  slot: Slot,
  status: EditionStatus,
  createdAt: isoDateTime,
  nudge: z.string().nullable(),
  weather: Weather,
  keyDates: z.array(KeyDate),
  sourceCount: z.number().int().min(0),
  stories: z.array(Story),
});
export type Edition = z.infer<typeof Edition>;
