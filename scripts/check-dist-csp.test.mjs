import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inlineScriptProblems } from './check-dist-csp.mjs';

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
