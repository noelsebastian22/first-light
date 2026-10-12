import { parse } from 'yaml';
import { z } from 'zod';
import type { KeyDate } from '@first-light/contracts';

const Entry = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  label: z.string().min(1),
  source: z.string().min(1),
  url: z.string().url(),
});

const WARN_WITHIN_DAYS = 30;

/** Adds days to a YYYY-MM-DD calendar date. Pure calendar arithmetic, no time zones involved. */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const at = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
}

/**
 * Reads `key-dates.yaml` and keeps the dates from `today` (inclusive) to `today + horizonDays`.
 * Warns when nothing falls in the next 30 days, which means the file needs its quarterly update.
 */
export function loadKeyDates(yamlText: string, today: string, horizonDays = 45): { dates: KeyDate[]; warning: string | null } {
  // `yaml` would turn an unquoted 2026-10-15 into a Date with the default schema; the core schema keeps strings.
  const raw: unknown = parse(yamlText, { schema: 'core' }) ?? [];
  const parsed = z.array(Entry).safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`key-dates.yaml: entry ${String(issue?.path[0] ?? '?')} ${issue?.path.slice(1).join('.') ?? ''} ${issue?.message ?? 'is invalid'}`.replace(/\s+/g, ' '));
  }

  const horizon = addDays(today, horizonDays);
  const soon = addDays(today, WARN_WITHIN_DAYS);
  const dates = parsed.data
    .filter((e) => e.date >= today && e.date <= horizon)
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
    .map((e): KeyDate => ({ date: e.date, timeLocal: e.time ?? null, label: e.label, sourceName: e.source, url: e.url }));

  const warning = dates.some((d) => d.date <= soon)
    ? null
    : `No key dates in the next ${WARN_WITHIN_DAYS} days: update pipeline/key-dates.yaml from the RBA and ABS calendars.`;
  return { dates, warning };
}
