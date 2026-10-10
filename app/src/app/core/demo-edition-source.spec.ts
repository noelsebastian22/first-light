import { TestBed } from '@angular/core/testing';
import { DemoEditionSource } from './demo-edition-source';

describe('DemoEditionSource', () => {
  let source: DemoEditionSource;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    source = TestBed.inject(DemoEditionSource);
  });

  it('returns the demo morning and afternoon editions for today', async () => {
    const today = await source.today();
    expect(today.am.slot).toBe('am');
    expect(today.am.editionDate).toBe('2026-10-13');
    expect(today.pm?.slot).toBe('pm');
  });

  it('finds a story with its edition, and null for an unknown id', async () => {
    const found = await source.story('demo-001');
    expect(found?.story.title).toContain('CPI');
    expect(found?.edition.slot).toBe('am');
    expect(await source.story('nope')).toBeNull();
  });

  it('searches titles and summaries case-insensitively, newest edition first', async () => {
    const hits = await source.search({ text: 'ANGULAR', section: 'all', savedOnly: false });
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(hits.every((h) => /angular/i.test(h.story.title + h.story.summary))).toBe(true);
    const dates = hits.map((h) => h.editionDate);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('narrows search by section', async () => {
    const hits = await source.search({ text: '', section: 'ai', savedOnly: false });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.story.section === 'ai')).toBe(true);
  });

  it('toggles saves and filters saved-only searches', async () => {
    await source.toggleSave('demo-008');
    expect(source.savedIds().has('demo-008')).toBe(true);
    const saved = await source.search({ text: '', section: 'all', savedOnly: true });
    expect(saved.map((h) => h.story.id)).toEqual(['demo-008']);
    await source.toggleSave('demo-008');
    expect(source.savedIds().has('demo-008')).toBe(false);
  });

  it('marks stories read', async () => {
    expect(source.readIds().has('demo-002')).toBe(false);
    await source.markRead('demo-002');
    expect(source.readIds().has('demo-002')).toBe(true);
  });
});
