import { describe, expect, it } from 'vitest';
import type { Db } from '../db';
import { runWatchdog, watchdogDecision } from './watchdog';

describe('watchdogDecision', () => {
  it('sends when the edition is missing', () => {
    const decision = watchdogDecision(null, 'am');
    expect(decision).toMatchObject({ send: true, subject: 'First Light: morning edition missing' });
  });

  it('names the afternoon edition in the pm check', () => {
    expect(watchdogDecision(null, 'pm')).toMatchObject({ send: true, subject: 'First Light: afternoon edition missing' });
  });

  it('sends the recorded error when the edition failed', () => {
    const decision = watchdogDecision({ status: 'failed', error: 'validate: stories[0]: unknown article id c999' }, 'am');
    expect(decision.send).toBe(true);
    if (!decision.send) return;
    expect(decision.subject).toBe('First Light: morning edition failed');
    expect(decision.body).toContain('validate: stories[0]: unknown article id c999');
  });

  it('stays quiet for an ok or partial edition', () => {
    expect(watchdogDecision({ status: 'ok', error: null }, 'am')).toEqual({ send: false });
    expect(watchdogDecision({ status: 'partial', error: null }, 'pm')).toEqual({ send: false });
  });
});

describe('runWatchdog', () => {
  const db = (rows: Record<string, unknown>[]): Db => ({ query: async () => rows, transaction: async () => [] });

  it('prints only "sent", never the error it emailed', async () => {
    const lines: string[] = [];
    const sent: string[] = [];
    await runWatchdog({
      now: () => new Date('2026-10-12T19:17:00.000Z'), // 6:17am Sydney
      db: db([{ status: 'failed', error: 'write: secret detail' }]),
      send: async (msg) => void sent.push(msg.text),
      print: (line) => lines.push(line),
    });
    expect(sent[0]).toContain('write: secret detail');
    expect(lines).toEqual(['sent']);
  });

  it('prints "skipped" when the edition is fine', async () => {
    const lines: string[] = [];
    await runWatchdog({
      now: () => new Date('2026-10-13T05:47:00.000Z'), // 4:47pm Sydney
      db: db([{ status: 'ok', error: null }]),
      send: async () => undefined,
      print: (line) => lines.push(line),
    });
    expect(lines).toEqual(['skipped']);
  });
});
