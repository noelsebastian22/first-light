import { TestBed } from '@angular/core/testing';
import { RangeBar } from './range-bar';

describe('RangeBar', () => {
  it('positions today’s range on a 0–30 scale and labels it for screen readers', async () => {
    TestBed.configureTestingModule({ imports: [RangeBar] });
    const f = TestBed.createComponent(RangeBar);
    f.componentRef.setInput('low', 7);
    f.componentRef.setInput('high', 17);
    f.componentRef.setInput('normalLow', 8);
    f.componentRef.setInput('normalHigh', 18);
    f.componentRef.setInput('now', 9);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const today = el.querySelector<HTMLElement>('.range-today')!;
    expect(today.style.left).toBe('23.33%');
    expect(today.style.width).toBe('33.33%');
    expect(el.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Today 7 to 17 degrees; average 8 to 18 degrees');
  });
});
