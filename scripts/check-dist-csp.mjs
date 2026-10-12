#!/usr/bin/env node
// Fails the build if index.html carries inline script, which the CSP in
// vercel.json (script-src falls back to 'self') would block in production, or
// loads an external origin missing from connect-src: the Angular service worker
// refetches every GET itself, and its fetches answer to connect-src.
// Usage: node scripts/check-dist-csp.mjs [file]   (default app/dist/app/browser/index.html)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_TYPES = /type\s*=\s*["']?application\/(ld\+)?json/i;

/** @returns {string[]} one line per inline script or inline event handler */
export function inlineScriptProblems(html) {
  const problems = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const [, attrs = '', body = ''] = m;
    if (/\bsrc\s*=/i.test(attrs) || DATA_TYPES.test(attrs) || body.trim() === '') continue;
    problems.push(`inline <script>: ${body.trim().slice(0, 60)}`);
  }
  for (const m of html.matchAll(/<[a-z][^>]*\s(on[a-z]+)\s*=/gi)) problems.push(`inline ${m[1]} handler`);
  return problems;
}

/** The Content-Security-Policy value set in vercel.json. */
export function cspFromVercel(json) {
  const config = JSON.parse(json);
  for (const rule of config.headers ?? []) {
    for (const h of rule.headers ?? []) if (h.key.toLowerCase() === 'content-security-policy') return h.value;
  }
  throw new Error('vercel.json sets no Content-Security-Policy');
}

/** @returns {string[]} external origins in href/src attributes that connect-src does not allow */
export function serviceWorkerGaps(csp, html) {
  const connect = csp.split(';').map((d) => d.trim().split(/\s+/)).find(([name]) => name === 'connect-src')?.slice(1) ?? [];
  const origins = new Set([...html.matchAll(/\b(?:href|src)\s*=\s*["'](https?:\/\/[^"'/]+)/gi)].map((m) => m[1]));
  return [...origins].filter((o) => !connect.includes(o)).sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = resolve(process.argv[2] ?? 'app/dist/app/browser/index.html');
  const html = readFileSync(file, 'utf8');
  const csp = cspFromVercel(readFileSync('vercel.json', 'utf8'));
  const problems = [
    ...inlineScriptProblems(html),
    ...serviceWorkerGaps(csp, html).map((o) => `${o} is loaded but missing from connect-src (the service worker fetches it)`),
  ];
  if (problems.length) {
    for (const p of problems) console.error(`${p} in ${file} (blocked by the CSP)`);
    process.exit(1);
  }
  console.log(`No inline script in ${file}`);
}
