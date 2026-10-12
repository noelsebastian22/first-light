import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Archive } from './archive';
import { MonthGrid } from './month-grid';
import { EDITION_SOURCE } from '../core/edition-source';
import { DemoEditionSource } from '../core/demo-edition-source';

const settle = async (f: { whenStable(): Promise<unknown> }, ms = 320) => {
  await new Promise((r) => setTimeout(r, ms));
  await f.whenStable();
};

async function render() {
  TestBed.configureTestingModule({
    imports: [Archive],
    providers: [provideRouter([]), { provide: EDITION_SOURCE, useExisting: DemoEditionSource }],
  });
  const f = TestBed.createComponent(Archive);
  await settle(f, 0);
  return { f, el: f.nativeElement as HTMLElement };
}

const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input'));
};
const titles = (el: HTMLElement) => [...el.querySelectorAll('.hit-title')].map((t) => t.textContent!.trim());

describe('Archive', () => {
  it('finds stories by text after a short debounce', async () => {
    const { f, el } = await render();
    type(el.querySelector<HTMLInputElement>('#archive-q')!, 'rba');
    await settle(f);
    expect(titles(el).length).toBeGreaterThan(0);
    expect(titles(el).some((t) => /RBA/.test(t))).toBe(true);
    expect(el.textContent).toMatch(/\d+ stor(y|ies)/);
  });

  it('narrows by section', async () => {
    const { f, el } = await render();
    const select = el.querySelector<HTMLSelectElement>('#archive-section')!;
    select.value = 'ai';
    select.dispatchEvent(new Event('input'));
    select.dispatchEvent(new Event('change'));
    await settle(f);
    const tags = [...el.querySelectorAll('.hit .tag')].map((t) => t.textContent!.trim());
    expect(tags.length).toBeGreaterThan(0);
    expect(new Set(tags)).toEqual(new Set(['AI']));
  });

  it('shows only saved stories when Saved only is ticked', async () => {
    const { f, el } = await render();
    await TestBed.inject(DemoEditionSource).toggleSave('demo-008');
    const box = el.querySelector<HTMLInputElement>('#archive-saved')!;
    box.click();
    await settle(f);
    expect(titles(el)).toEqual(['Angular v20 leaves long-term support in November']);
  });

  it('says so when nothing matches', async () => {
    const { f, el } = await render();
    type(el.querySelector<HTMLInputElement>('#archive-q')!, 'zzzz-no-match');
    await settle(f);
    expect(el.textContent).toContain('Nothing matches');
  });
});

describe('MonthGrid', () => {
  it('starts October 2026 on a Thursday: three blanks, then 31 days', async () => {
    TestBed.configureTestingModule({ imports: [MonthGrid] });
    const f = TestBed.createComponent(MonthGrid);
    f.componentRef.setInput('month', '2026-10');
    f.componentRef.setInput('days', [{ date: '2026-10-13', am: true, pm: true }]);
    await f.whenStable();
    const cells = [...(f.nativeElement as HTMLElement).querySelectorAll('.cell')];
    expect(cells.slice(0, 3).every((c) => c.classList.contains('blank'))).toBe(true);
    expect(cells.filter((c) => !c.classList.contains('blank')).length).toBe(31);
    expect(cells[3 + 12]!.querySelectorAll('.dot').length).toBe(2);
  });
});
