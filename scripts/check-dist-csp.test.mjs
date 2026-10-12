import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cspFromVercel, inlineScriptProblems, serviceWorkerGaps } from './check-dist-csp.mjs';

test('external module scripts and JSON data blocks pass', () => {
  const html = '<script src="main.js" type="module"></script><script type="application/ld+json">{"a":1}</script>';
  assert.deepEqual(inlineScriptProblems(html), []);
});

test('flags an inline script, which the CSP blocks', () => {
  const html = `<script>document.querySelectorAll('link[data-beasties-media]').forEach(f)</script>`;
  assert.equal(inlineScriptProblems(html).length, 1);
});

test('flags an inline event handler', () => {
  const html = `<link rel="stylesheet" href="styles.css" media="print" onload="this.media='all'">`;
  assert.equal(inlineScriptProblems(html).length, 1);
});

test('every external origin the page loads is in connect-src, because the service worker refetches it', () => {
  const html = '<link href="https://fonts.googleapis.com/css2?family=X" rel="stylesheet"><link rel="preconnect" href="https://fonts.gstatic.com">';
  assert.deepEqual(serviceWorkerGaps("default-src 'self'; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com", html), []);
  assert.deepEqual(serviceWorkerGaps("default-src 'self'; connect-src 'self' https://api.open-meteo.com", html), [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
  ]);
});

test('the CSP in vercel.json lets the service worker fetch what index.html loads', () => {
  const csp = cspFromVercel(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const html = readFileSync(new URL('../app/src/index.html', import.meta.url), 'utf8');
  assert.deepEqual(serviceWorkerGaps(csp, html), []);
});
