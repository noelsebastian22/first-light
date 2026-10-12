import { describe, expect, it } from 'vitest';
import type { Db, Statement } from './db';
import { loadRecentUrls } from './db';

describe('loadRecentUrls', () => {
  it('leaves out the edition this run will replace, so a rerun can reuse its articles', async () => {
    const asked: Statement[] = [];
    const db: Db = {
      query: async (statement) => {
        asked.push(statement);
        return [{ url: 'https://example.com/a' }];
      },
      transaction: async () => [],
    };
    const urls = await loadRecentUrls(db, new Date('2026-10-12T18:32:00.000Z'), '2026-10-13', 'am');

    expect([...urls]).toEqual(['https://example.com/a']);
    expect(asked[0]?.text).toMatch(/not \(e\.edition_date = \$2 and e\.slot = \$3\)/);
    expect(asked[0]?.params).toEqual(['2026-10-10T18:32:00.000Z', '2026-10-13', 'am']);
  });
});
