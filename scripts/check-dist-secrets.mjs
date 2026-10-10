#!/usr/bin/env node
// Fails the build if anything secret-shaped ends up in the browser bundle.
// Usage: node scripts/check-dist-secrets.mjs [dir]   (default app/dist)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SECRET_PATTERN = /postgres(ql)?:\/\/|sk-ant-|npg_[A-Za-z0-9]{8,}/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

/** @returns {{file: string, match: string}[]} */
export function findSecrets(dir) {
  const hits = [];
  for (const file of walk(dir)) {
    const m = readFileSync(file, 'latin1').match(SECRET_PATTERN);
    if (m) hits.push({ file, match: m[0] });
  }
  return hits;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = resolve(process.argv[2] ?? 'app/dist');
  const hits = findSecrets(dir);
  if (hits.length) {
    for (const h of hits) console.error(`secret-like string "${h.match.slice(0, 12)}…" in ${h.file}`);
    process.exit(1);
  }
  console.log(`No secret-like strings in ${dir}`);
}
