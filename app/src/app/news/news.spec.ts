import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Edition } from '@first-light/contracts';
import demo from '../../../../fixtures/demo-edition.json';
import { News } from './news';
import { EDITION_SOURCE } from '../core/edition-source';
import { DemoEditionSource } from '../core/demo-edition-source';

const am = demo.am as unknown as Edition;
const pm = demo.pm as unknown as Edition;

async function render(opts: { am?: Edition; storyId?: string } = {}) {
  TestBed.configureTestingModule({
    imports: [News],
    providers: [provideRouter([]), { provide: EDITION_SOURCE, useExisting: DemoEditionSource }],
  });
  const f = TestBed.createComponent(News);
  f.componentRef.setInput('editions', { am: opts.am ?? am, pm });
  if (opts.storyId) f.componentRef.setInput('storyId', opts.storyId);
  await f.whenStable();
  await new Promise((r) => setTimeout(r));
  await f.whenStable();
  return { f, el: f.nativeElement as HTMLElement };
}

const chipText = (el: HTMLElement) => [...el.querySelectorAll('.chips button')].map((b) => b.textContent!.replace(/\s+/g, ' ').trim());

describe('News', () => {
  it('shows a chip per non-empty section with counts, plus All', async () => {
    const noWorld = { ...am, stories: am.stories.filter((s) => s.section !== 'world') };
    const { el } = await render({ am: noWorld });
    const chips = chipText(el);
    expect(chips[0]).toBe(`All ${noWorld.stories.length + pm.stories.length}`);
    expect(chips.some((c) => c.startsWith('World'))).toBe(false);
    expect(chips).toContain('AU economy 4');
  });

  it('filters to one section', async () => {
    const { f, el } = await render();
    [...el.querySelectorAll<HTMLButtonElement>('.chips button')].find((b) => b.textContent!.includes('Web dev'))!.click();
    await f.whenStable();
    const tags = [...el.querySelectorAll('.story-row .tag')].map((t) => t.textContent!.trim());
    expect(new Set(tags)).toEqual(new Set(['Web dev']));
  });

  it('puts afternoon stories first with a New badge', async () => {
    const { el } = await render();
    const first = el.querySelector('.story-row')!;
    expect(first.textContent).toContain(pm.stories[0]!.title);
    expect(first.querySelector('.new-badge')).not.toBeNull();
  });

  it('marks a story read when it is opened', async () => {
    const { f, el } = await render();
    const before = el.querySelectorAll('.unread-dot').length;
    el.querySelectorAll<HTMLButtonElement>('.story-row')[2]!.click();
    await f.whenStable();
    await new Promise((r) => setTimeout(r));
    await f.whenStable();
    expect(el.querySelectorAll('.unread-dot').length).toBe(before - 1);
  });

  it('toggles Save for the open story', async () => {
    const { f, el } = await render({ storyId: 'demo-001' });
    const save = el.querySelector<HTMLButtonElement>('.detail .save')!;
    expect(save.textContent!.trim()).toBe('Save for later');
    save.click();
    await f.whenStable();
    expect(save.textContent!.trim()).toBe('Saved');
  });

  it('links to publishers in a new tab with rel=noopener', async () => {
    const { el } = await render({ storyId: 'demo-001' });
    const links = [...el.querySelectorAll<HTMLAnchorElement>('.detail .coverage a')];
    expect(links.length).toBe(2);
    expect(links[0]!.getAttribute('href')).toBe('https://www.abs.gov.au/release-calendar/future-releases');
    expect(links[0]!.getAttribute('target')).toBe('_blank');
    expect(links[0]!.getAttribute('rel')).toContain('noopener');
  });

  it('renders model text literally, never as HTML', async () => {
    const tricky = { ...am, stories: am.stories.map((s, i) => (i === 0 ? { ...s, title: 'Rates <b>up</b>' } : s)) };
    const { el } = await render({ am: tricky, storyId: 'demo-001' });
    expect(el.querySelector('.detail h2')!.textContent).toBe('Rates <b>up</b>');
    expect(el.querySelector('.detail h2 b')).toBeNull();
  });
});
