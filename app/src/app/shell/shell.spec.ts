import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { Shell } from './shell';
import { Nav } from './nav';
import { EDITION_SOURCE } from '../core/edition-source';

@Component({ template: '<p>page</p>' })
class Page {}

async function setup(url = '/demo/today', live = false) {
  localStorage.clear();
  TestBed.configureTestingModule({
    imports: [Shell],
    providers: [
      provideRouter([{ path: 'demo', children: [{ path: '**', component: Page }] }]),
      { provide: EDITION_SOURCE, useValue: { live } },
    ],
  });
  const router = TestBed.inject(Router);
  const fixture = TestBed.createComponent(Shell);
  await router.navigateByUrl(url);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('Shell', () => {
  it('collapses the drawer with a toggle that reports aria-expanded', async () => {
    const { fixture, el } = await setup();
    const toggle = el.querySelector<HTMLButtonElement>('button[aria-controls="fl-drawer"]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('.drawer .nav-label')).not.toBeNull();
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('.drawer .nav-label')).toBeNull();
    expect(TestBed.inject(Nav).drawerOpen()).toBe(false);
  });

  it('shows a mobile bottom bar with Today, News, Archive and More', async () => {
    const { el } = await setup();
    const labels = [...el.querySelectorAll('.bottombar a, .bottombar button')].map((n) => n.textContent?.trim());
    expect(labels).toEqual(['Today', 'News', 'Archive', 'More']);
  });

  it('opens the More sheet with Preferences, About and Sign in', async () => {
    const { fixture, el } = await setup();
    el.querySelector<HTMLButtonElement>('.bottombar button')!.click();
    await fixture.whenStable();
    const sheet = el.querySelector('[role="dialog"]');
    expect(sheet).not.toBeNull();
    expect(sheet!.textContent).toContain('Reduce motion');
    expect(sheet!.textContent).toContain('About First Light');
    expect(sheet!.textContent).toContain('Sign in');
    expect(sheet!.textContent).not.toContain('Sign out');
  });

  it('offers Sign out instead of Sign in on the live edition', async () => {
    const { fixture, el } = await setup('/demo/today', true);
    el.querySelector<HTMLButtonElement>('.bottombar button')!.click();
    await fixture.whenStable();
    const sheet = el.querySelector('[role="dialog"]')!;
    expect(sheet.textContent).toContain('Sign out');
    expect(sheet.textContent).not.toContain('Sign in');
  });

  it('explains the private edition when redirected with ?private=1', async () => {
    const { el } = await setup('/demo/today?private=1');
    expect(el.textContent).toContain('This is a private edition');
  });
});
