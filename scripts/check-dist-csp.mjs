#!/usr/bin/env node
// Fails the build if index.html carries inline script, which the CSP in
// vercel.json (script-src falls back to 'self') would block in production.
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = resolve(process.argv[2] ?? 'app/dist/app/browser/index.html');
  const problems = inlineScriptProblems(readFileSync(file, 'utf8'));
  if (problems.length) {
    for (const p of problems) console.error(`${p} in ${file} (blocked by the CSP)`);
    process.exit(1);
  }
  console.log(`No inline script in ${file}`);
}
