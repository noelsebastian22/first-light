import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findSecrets } from './check-dist-secrets.mjs';

function dir(files) {
  const root = mkdtempSync(join(tmpdir(), 'fl-dist-'));
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(root, name, '..'), { recursive: true });
    writeFileSync(join(root, name), body);
  }
  return root;
}

test('clean build passes', () => {
  assert.deepEqual(findSecrets(dir({ 'main.js': 'const x = "https://api.open-meteo.com";' })), []);
});

test('flags a postgres URL, an Anthropic key and a Neon password', () => {
  const hits = findSecrets(dir({
    'a.js': 'const u = "postgresql://u:p@host/db";',
    'nested/b.js': 'k="sk-ant-api03-xyz"',
    'c.html': 'pw npg_AbCd1234EfGh',
  }));
  assert.equal(hits.length, 3);
  assert.ok(hits.some((h) => h.file.endsWith('b.js')));
});

test('ignores short npg_ tokens', () => {
  assert.deepEqual(findSecrets(dir({ 'a.js': 'npg_abc' })), []);
});
