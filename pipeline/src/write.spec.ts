import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Edition } from '@first-light/contracts';
import { buildFailStatement, buildWriteStatements, planWrite } from './write';
import type { Statement } from './db';

const demo = Edition.parse(JSON.parse(readFileSync(new URL('../../fixtures/demo-edition.json', import.meta.url), 'utf8')).am);

/** Every string value in the edition, so a test can prove none was spliced into SQL text. */
function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(stringsIn);
  return [];
}

function placeholders(statement: Statement): number {
  return new Set(statement.text.match(/\$\d+/g) ?? []).size;
}

describe('planWrite', () => {
  it('inserts when there is no edition for that date and slot', () => {
    expect(planWrite(null, false)).toBe('insert');
  });

  it('replaces a failed or partial edition', () => {
    expect(planWrite({ status: 'failed' }, false)).toBe('replace');
    expect(planWrite({ status: 'partial' }, false)).toBe('replace');
  });

  it('refuses to overwrite an ok edition unless forced', () => {
    expect(planWrite({ status: 'ok' }, false)).toBe('refuse');
    expect(planWrite({ status: 'ok' }, true)).toBe('replace');
  });
});

describe('buildWriteStatements', () => {
  const statements = buildWriteStatements(demo);

  it('passes every value as a parameter, never in the SQL text', () => {
    // Short tokens like "am" or "ok" could match SQL words by chance; real content is longer.
    const values = stringsIn(demo).filter((s) => s.length > 3);
    for (const statement of statements) {
      for (const value of values) expect(statement.text).not.toContain(value);
      expect(placeholders(statement)).toBe(statement.params.length);
    }
  });

  it('upserts the edition, clears its old stories, then inserts stories and links', () => {
    const kinds = statements.map((s) => s.text.trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase());
    expect(kinds.slice(0, 3)).toEqual(['delete from story_links', 'delete from stories', 'insert into editions']);
    expect(statements[2]?.text).toMatch(/on conflict \(edition_date, slot\) do update/i);
  });

  it('inserts one story row per story', () => {
    const stories = statements.filter((s) => /^insert into stories/i.test(s.text.trim()));
    expect(stories).toHaveLength(demo.stories.length);
    expect(stories.map((s) => s.params[0])).toEqual(demo.stories.map((s) => s.id));
  });

  it('inserts one link row per story link', () => {
    const links = statements.filter((s) => /^insert into story_links/i.test(s.text.trim()));
    const expected = demo.stories.flatMap((s) => s.links.map((l) => [s.id, l.sourceKey, l.url, l.publisherTitle, l.publishedAt]));
    expect(links.map((s) => s.params)).toEqual(expected);
  });

  it('stores weather and key dates as JSON', () => {
    const edition = statements[2];
    expect(edition?.params).toContain(JSON.stringify(demo.weather));
    expect(edition?.params).toContain(JSON.stringify(demo.keyDates));
  });
});

describe('buildFailStatement', () => {
  const statement = buildFailStatement({
    editionId: 'ed-2026-10-13-am',
    editionDate: '2026-10-13',
    slot: 'am',
    error: 'validate: stories[0]: unknown article id c999',
    at: new Date('2026-10-12T18:40:00.000Z'),
  });

  it('records the error as a failed edition, using parameters only', () => {
    expect(statement.text).not.toContain('unknown article id');
    expect(statement.params).toContain('validate: stories[0]: unknown article id c999');
    expect(placeholders(statement)).toBe(statement.params.length);
  });

  it('only overwrites an edition that is already failed', () => {
    expect(statement.text).toMatch(/on conflict \(edition_date, slot\) do update[\s\S]*where editions\.status = 'failed'/i);
  });
});
