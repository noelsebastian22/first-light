import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import type { Edition } from '@first-light/contracts';
import demo from '../../../../fixtures/demo-edition.json';
import { Today } from './today';
import { EDITION_SOURCE } from '../core/edition-source';
import { DemoEditionSource } from '../core/demo-edition-source';

const am = demo.am as unknown as Edition;
const pm = demo.pm as unknown as Edition;

async function render(editions: { am: Edition; pm: Edition | null }, source?: object) {
  TestBed.configureTestingModule({
    imports: [Today],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      source ? { provide: EDITION_SOURCE, useValue: source } : { provide: EDITION_SOURCE, useExisting: DemoEditionSource },
    ],
  });
  const f = TestBed.createComponent(Today);
  f.componentRef.setInput('editions', editions);
  await f.whenStable();
  return { f, el: f.nativeElement as HTMLElement };
}

describe('Today', () => {
  describe('afternoon poll (live)', () => {
    afterEach(() => vi.useRealTimers());
    const live = (today: () => Promise<unknown>) => ({ live: true, today: vi.fn(today), readIds: () => new Set(), savedIds: () => new Set() });

    it('after 4:02pm, picks up the pm edition and greets the afternoon', async () => {
      vi.useFakeTimers({ now: new Date('2026-10-13T05:10:00Z'), toFake: ['Date'] }); // 4:10pm AEDT
      const source = live(async () => ({ am, pm }));
      const { f, el } = await render({ am, pm: null }, source);
      await vi.waitFor(() => expect(source.today).toHaveBeenCalled());
      await f.whenStable();
      expect(el.querySelector('h1')!.textContent).toContain('Good afternoon.');
    });

    it('does not ask before 4:02pm', async () => {
      vi.useFakeTimers({ now: new Date('2026-10-13T04:00:00Z'), toFake: ['Date'] }); // 3:00pm AEDT
      const source = live(async () => ({ am, pm }));
      const { f, el } = await render({ am, pm: null }, source);
      await new Promise((r) => setTimeout(r, 20));
      await f.whenStable();
      expect(source.today).not.toHaveBeenCalled();
      expect(el.querySelector('h1')!.textContent).toContain('Good morning.');
    });
  });

  it('greets the afternoon once the pm edition is showing', async () => {
    const { el } = await render({ am, pm });
    expect(el.querySelector('h1')!.textContent).toContain('Good afternoon.');
    expect(el.textContent).toContain('Next edition 5:32am');
  });

  it('greets the morning before the pm edition lands', async () => {
    const { el } = await render({ am, pm: null });
    expect(el.querySelector('h1')!.textContent).toContain('Good morning.');
    expect(el.textContent).toContain('Next edition 4:02pm');
  });

  it('greets the afternoon when the pm edition leads because the am one failed', async () => {
    const { el } = await render({ am: pm, pm: null });
    expect(el.querySelector('h1')!.textContent).toContain('Good afternoon.');
    expect(el.textContent).toContain('Next edition 5:32am');
  });

  it('shows the date, nudge and the three things to know in rank order', async () => {
    const { el } = await render({ am, pm });
    expect(el.querySelector('h1')!.textContent).toContain('Good afternoon');
    expect(el.textContent).toContain('Tuesday 13 October');
    expect(el.textContent).toContain(am.nudge!);
    const titles = [...el.querySelectorAll('.top3 h3')].map((h) => h.textContent!.trim());
    const expected = am.stories.filter((s) => s.topRank).sort((a, b) => a.topRank! - b.topRank!).map((s) => s.title);
    expect(titles).toEqual(expected);
  });

  it('lists key dates', async () => {
    const { el } = await render({ am, pm });
    expect(el.querySelector('.dates')!.textContent).toContain('CPI, September quarter');
  });

  it('hides a section with no stories from the overview', async () => {
    const noWorld = { ...am, stories: am.stories.filter((s) => s.section !== 'world') };
    const { el } = await render({ am: noWorld, pm: null });
    const names = [...el.querySelectorAll('.overview .tag')].map((t) => t.textContent!.trim());
    expect(names).not.toContain('World');
    expect(names).toContain('AU economy');
  });

  it('explains when the afternoon edition lands if it is not out yet', async () => {
    const { f, el } = await render({ am, pm: null });
    el.querySelector<HTMLButtonElement>('button[data-slot="pm"]')!.click();
    await f.whenStable();
    expect(el.textContent).toContain("The afternoon edition isn't out yet");
    expect(el.textContent).not.toContain('New since');
  });

  it('shows how many stories are new since the morning when the afternoon edition exists', async () => {
    const { f, el } = await render({ am, pm });
    el.querySelector<HTMLButtonElement>('button[data-slot="pm"]')!.click();
    await f.whenStable();
    expect(el.textContent).toContain(`${pm.stories.length} new since 5:31am`);
  });

  it('carries the small-print credits', async () => {
    const { el } = await render({ am, pm });
    expect(el.textContent).toContain('Edited by Claude');
    expect(el.textContent).toContain('Weather data by Open-Meteo.com');
  });
});
