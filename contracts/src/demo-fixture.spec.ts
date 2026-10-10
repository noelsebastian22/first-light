import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Edition, MAX_STORIES_PER_SECTION, SECTIONS } from './index';

const raw = JSON.parse(readFileSync(new URL('../../fixtures/demo-edition.json', import.meta.url), 'utf8')) as {
  am: unknown;
  pm: unknown;
  archive: unknown[];
};

describe('demo edition fixture', () => {
  const am = Edition.parse(raw.am);
  const pm = Edition.parse(raw.pm);

  it('has a morning edition with a nudge and exactly three ranked top stories', () => {
    expect(am.slot).toBe('am');
    expect(am.nudge).toBeTruthy();
    const ranks = am.stories.filter((s) => s.topRank !== null).map((s) => s.topRank).sort();
    expect(ranks).toEqual([1, 2, 3]);
  });

  it('fills every section with 1-4 stories in the morning', () => {
    for (const section of SECTIONS) {
      const n = am.stories.filter((s) => s.section === section).length;
      expect(n, section).toBeGreaterThanOrEqual(1);
      expect(n, section).toBeLessThanOrEqual(MAX_STORIES_PER_SECTION);
    }
  });

  it('has an afternoon edition with no nudge and no top stories', () => {
    expect(pm.slot).toBe('pm');
    expect(pm.nudge).toBeNull();
    expect(pm.stories.every((s) => s.topRank === null)).toBe(true);
    expect(pm.stories.length).toBeGreaterThanOrEqual(2);
  });

  it('has at least six valid archive editions with unique story ids overall', () => {
    const archive = raw.archive.map((e) => Edition.parse(e));
    expect(archive.length).toBeGreaterThanOrEqual(6);
    const ids = [am, pm, ...archive].flatMap((e) => e.stories.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
