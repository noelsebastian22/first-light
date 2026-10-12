import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { Edition } from '@first-light/contracts';
import { runCli } from './cli';
import type { CliDeps } from './cli';
import type { Db, Statement } from './db';

/** In-memory stand-in for Neon: answers the existing-edition lookup and records transactions. */
function fakeDb(existing: { status: string } | null) {
  const transactions: Statement[][] = [];
  const db: Db = {
    query: async () => (existing ? [existing] : []),
    transaction: async (statements) => {
      transactions.push(statements);
      return [];
    },
  };
  return { db, transactions };
}

let outDir: string;
let lines: string[];

function deps(over: Partial<CliDeps> = {}): CliDeps {
  return {
    env: {},
    outDir,
    now: () => new Date('2026-10-12T18:32:00.000Z'),
    fetch: () => Promise.reject(new Error('no network in tests')),
    print: (line) => lines.push(line),
    connect: () => {
      throw new Error('no database in tests');
    },
    ...over,
  };
}

beforeEach(() => {
  outDir = mkdtempSync(join(tmpdir(), 'first-light-cli-'));
  lines = [];
});

describe('demo-run', () => {
  it('fetches from fixtures, validates the sample model edition and exits 0', async () => {
    expect(await runCli(['demo-run'], deps())).toBe(0);
    const edition = Edition.parse(JSON.parse(readFileSync(join(outDir, 'validated.json'), 'utf8')));
    expect(edition.slot).toBe('am');
    expect(edition.editionDate).toBe('2026-10-13');
    expect(edition.stories.length).toBeGreaterThan(0);
    expect(edition.stories.every((s) => s.links.length > 0)).toBe(true);
  });
});

describe('validate', () => {
  it('prints readable errors and exits 1 when the model cites an unknown article', async () => {
    await runCli(['demo-run'], deps());
    const model = JSON.parse(readFileSync(join(outDir, 'edition.json'), 'utf8'));
    model.stories[0].articleIds = ['c999'];
    writeFileSync(join(outDir, 'edition.json'), JSON.stringify(model));
    lines = [];

    expect(await runCli(['validate'], deps())).toBe(1);
    expect(lines.join('\n')).toContain('stories[0]: unknown article id c999');
  });

  it('exits 2 when the files it needs are missing', async () => {
    expect(await runCli(['validate'], deps())).toBe(2);
  });
});

describe('write', () => {
  beforeEach(async () => {
    await runCli(['demo-run'], deps());
    lines = [];
  });

  it('exits 2 without DATABASE_URL', async () => {
    expect(await runCli(['write'], deps())).toBe(2);
  });

  it('writes a new edition in one transaction', async () => {
    const { db, transactions } = fakeDb(null);
    expect(await runCli(['write'], deps({ env: { DATABASE_URL: 'postgres://x' }, connect: () => db }))).toBe(0);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.some((s) => /insert into editions/i.test(s.text))).toBe(true);
  });

  it('leaves an ok edition alone unless forced', async () => {
    const { db, transactions } = fakeDb({ status: 'ok' });
    const env = { DATABASE_URL: 'postgres://x' };
    expect(await runCli(['write'], deps({ env, connect: () => db }))).toBe(0);
    expect(transactions).toHaveLength(0);
    expect(lines.join('\n')).toMatch(/skipped/);

    expect(await runCli(['write', '--force'], deps({ env, connect: () => db }))).toBe(0);
    expect(transactions).toHaveLength(1);
  });
});

describe('fail', () => {
  it('records the error against the edition named in context.json', async () => {
    await runCli(['demo-run'], deps());
    const { db, transactions } = fakeDb(null);
    expect(await runCli(['fail', 'validate: still invalid after 2 retries'], deps({ env: { DATABASE_URL: 'postgres://x' }, connect: () => db }))).toBe(0);
    const statement = transactions[0]?.[0];
    expect(statement?.params).toContain('validate: still invalid after 2 retries');
    expect(statement?.params).toContain('ed-2026-10-13-am');
  });

  it('falls back to the Sydney clock when fetch never ran', async () => {
    const { db, transactions } = fakeDb(null);
    // 04:10 UTC is 3:10pm in Sydney (AEDT): the afternoon slot.
    const now = () => new Date('2026-10-13T04:10:00.000Z');
    expect(await runCli(['fail', 'fetch: weather: HTTP 503'], deps({ now, env: { DATABASE_URL: 'postgres://x' }, connect: () => db }))).toBe(0);
    expect(transactions[0]?.[0]?.params).toContain('ed-2026-10-13-pm');
  });
});

it('exits 2 on an unknown command', async () => {
  expect(await runCli(['publish'], deps())).toBe(2);
});
