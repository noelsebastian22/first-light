import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Landing } from './landing';
import { Prefs } from '../core/prefs';

async function render(reduceMotion: boolean) {
  localStorage.clear();
  TestBed.configureTestingModule({
    imports: [Landing],
    providers: [provideRouter([])],
    deferBlockBehavior: DeferBlockBehavior.Manual,
  });
  TestBed.inject(Prefs).reduceMotion.set(reduceMotion);
  const f = TestBed.createComponent(Landing);
  await f.whenStable();
  for (const block of await f.getDeferBlocks()) await block.render(DeferBlockState.Complete);
  await f.whenStable();
  return f.nativeElement as HTMLElement;
}

describe('Landing', () => {
  it('leads with the promise and a way into the demo', async () => {
    const el = await render(false);
    expect(el.querySelector('h1')!.textContent).toContain('Your morning, already read.');
    const demoLinks = [...el.querySelectorAll('a')].filter((a) => a.getAttribute('href') === '/demo/today');
    expect(demoLinks.length).toBeGreaterThan(0);
  });

  it('explains Gather, Think and Deliver', async () => {
    const el = await render(false);
    const steps = [...el.querySelectorAll('.step-name')].map((s) => s.textContent!.trim());
    expect(steps).toEqual(['01 · Gather', '02 · Think', '03 · Deliver']);
  });

  it('shows security notes, the stack and the small-print credit', async () => {
    const el = await render(false);
    expect(el.textContent).toContain('Safe by design');
    expect(el.textContent).toContain('No button runs the AI');
    expect([...el.querySelectorAll('.stack li')].length).toBeGreaterThanOrEqual(8);
    expect(el.querySelector('footer')!.textContent).toContain('Edited by Claude');
  });

  it('runs the Morning Machine, and pauses it when reduce motion is on', async () => {
    expect((await render(false)).querySelector('app-morning-machine')!.classList.contains('paused')).toBe(false);
    TestBed.resetTestingModule();
    expect((await render(true)).querySelector('app-morning-machine')!.classList.contains('paused')).toBe(true);
  });
});
