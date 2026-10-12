import type { Edition, Slot } from '@first-light/contracts';
import type { Statement } from './db';

/**
 * Spec §5, step 5: a failed or partial edition is replaced; an ok one is
 * left alone unless the run is forced.
 */
export function planWrite(existing: { status: Edition['status'] } | null, force: boolean): 'insert' | 'replace' | 'refuse' {
  if (existing === null) return 'insert';
  if (existing.status === 'ok' && !force) return 'refuse';
  return 'replace';
}

const SAME_SLOT = `select id from editions where edition_date = $1 and slot = $2`;

/**
 * Everything one edition needs, for a single transaction. The old stories for
 * the same date and slot are cleared first (a no-op on insert), so the edition
 * row can take the new id and the stories never mix two runs.
 */
export function buildWriteStatements(edition: Edition): Statement[] {
  const slot = [edition.editionDate, edition.slot];
  const statements: Statement[] = [
    {
      text: `delete from story_links where story_id in (select s.id from stories s where s.edition_id in (${SAME_SLOT}))`,
      params: slot,
    },
    { text: `delete from stories where edition_id in (${SAME_SLOT})`, params: slot },
    {
      text: `insert into editions (id, edition_date, slot, status, error, nudge, weather, key_dates, source_count, created_at)
             values ($1, $2, $3, $4, null, $5, $6::jsonb, $7::jsonb, $8, $9)
             on conflict (edition_date, slot) do update set
               id = excluded.id, status = excluded.status, error = null, nudge = excluded.nudge,
               weather = excluded.weather, key_dates = excluded.key_dates,
               source_count = excluded.source_count, created_at = excluded.created_at`,
      params: [
        edition.id,
        edition.editionDate,
        edition.slot,
        edition.status,
        edition.nudge,
        JSON.stringify(edition.weather),
        JSON.stringify(edition.keyDates),
        edition.sourceCount,
        edition.createdAt,
      ],
    },
  ];

  for (const story of edition.stories) {
    statements.push({
      text: `insert into stories (id, edition_id, section, rank, top_rank, title, summary, why_it_matters, picked_because)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      params: [story.id, edition.id, story.section, story.rank, story.topRank, story.title, story.summary, story.whyItMatters, story.pickedBecause],
    });
    for (const link of story.links) {
      statements.push({
        text: `insert into story_links (story_id, source_key, url, publisher_title, published_at) values ($1, $2, $3, $4, $5)`,
        params: [story.id, link.sourceKey, link.url, link.publisherTitle, link.publishedAt],
      });
    }
  }
  return statements;
}

/**
 * Spec §5, step 6: marks the edition failed so the watchdog emails the error.
 * Never overwrites an ok or partial edition: a failed re-run must not hide one
 * that readers already have.
 */
export function buildFailStatement(input: { editionId: string; editionDate: string; slot: Slot; error: string; at: Date }): Statement {
  return {
    text: `insert into editions (id, edition_date, slot, status, error, nudge, weather, key_dates, source_count, created_at)
           values ($1, $2, $3, 'failed', $4, null, null, '[]'::jsonb, 0, $5)
           on conflict (edition_date, slot) do update set error = excluded.error, created_at = excluded.created_at
           where editions.status = 'failed'`,
    params: [input.editionId, input.editionDate, input.slot, input.error, input.at.toISOString()],
  };
}
