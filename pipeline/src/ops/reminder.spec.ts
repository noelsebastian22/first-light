import { describe, expect, it } from 'vitest';
import type { Db, Statement } from '../db';
import { reminderDecision, runReminder } from './reminder';

const am = {
  status: 'ok' as const,
  nudge: 'Fog in Katoomba: leave a few minutes early.',
  topTitles: ['Rate held at 3.60%', 'Wages up 0.8%', 'Signals land in framework 9'],
};
const appUrl = 'https://firstlight.noel-sebastian.com';

describe('reminderDecision', () => {
  it('sends the nudge, the Top 3 and a link when the app has not been opened', () => {
    const decision = reminderDecision(am, false, appUrl);
    expect(decision.send).toBe(true);
    if (!decision.send) return;
    expect(decision.subject).toBe("Today's edition is ready");
    expect(decision.body).toContain(am.nudge);
    for (const title of am.topTitles) expect(decision.body).toContain(title);
    expect(decision.body).toContain('https://firstlight.noel-sebastian.com/today');
  });

  it('also sends for a partial edition', () => {
    expect(reminderDecision({ ...am, status: 'partial' }, false, appUrl).send).toBe(true);
  });

  it('stays quiet once the app has been opened today', () => {
    expect(reminderDecision(am, true, appUrl)).toEqual({ send: false });
  });

  it('stays quiet when the morning edition is missing or failed', () => {
    expect(reminderDecision(null, false, appUrl)).toEqual({ send: false });
    expect(reminderDecision({ ...am, status: 'failed' }, false, appUrl)).toEqual({ send: false });
  });
});

describe('runReminder', () => {
  it('asks about today in Sydney and prints only "sent"', async () => {
    const asked: Statement[] = [];
    const db: Db = {
      query: async (statement) => {
        asked.push(statement);
        if (/from editions/.test(statement.text)) return [{ id: 'ed-2026-10-13-am', status: 'ok', nudge: am.nudge }];
        if (/from stories/.test(statement.text)) return am.topTitles.map((title) => ({ title }));
        return [{ opened: false }];
      },
      transaction: async () => [],
    };
    const lines: string[] = [];
    await runReminder({
      now: () => new Date('2026-10-12T20:57:00.000Z'), // 7:57am Sydney, 13 October
      db,
      appUrl,
      send: async () => undefined,
      print: (line) => lines.push(line),
    });
    expect(asked[0]?.params).toContain('2026-10-13');
    expect(lines).toEqual(['sent']);
  });
});
