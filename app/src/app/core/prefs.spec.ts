import { TestBed } from '@angular/core/testing';
import { Prefs } from './prefs';

describe('Prefs', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('persists reduce-motion and density across instances', () => {
    TestBed.configureTestingModule({});
    const a = TestBed.inject(Prefs);
    a.reduceMotion.set(true);
    a.density.set('compact');
    TestBed.flushEffects();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const b = TestBed.inject(Prefs);
    expect(b.reduceMotion()).toBe(true);
    expect(b.density()).toBe('compact');
  });

  it('falls back to defaults when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    TestBed.configureTestingModule({});
    const p = TestBed.inject(Prefs);
    expect(p.density()).toBe('comfortable');
    expect(typeof p.reduceMotion()).toBe('boolean');
  });
});
