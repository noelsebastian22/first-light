import { pathToFileURL } from 'node:url';
import { sydneyDate, sydneyTime } from '@first-light/contracts';
import type { Edition, Slot } from '@first-light/contracts';
import { createSql } from '../db';
import type { Db } from '../db';
import { mailConfigFromEnv, requireEnv, runOps, sendMail } from './mail';
import type { MailMessage } from './mail';

export type MailDecision = { send: false } | { send: true; subject: string; body: string };

const SLOT_NAME = { am: 'morning', pm: 'afternoon' } as const;
const RECOVER = 'To recover, open your Claude Code routines (https://claude.ai/code) and press Run now on First Light. See docs/runbook.md, section 4.';

/** Spec §7: email on a missing or failed edition; ok and partial are quiet. */
export function watchdogDecision(edition: { status: Edition['status']; error: string | null } | null, slot: Slot): MailDecision {
  const name = SLOT_NAME[slot];
  if (edition === null) {
    return { send: true, subject: `First Light: ${name} edition missing`, body: `Today's ${name} edition was never written.\n\n${RECOVER}` };
  }
  if (edition.status !== 'failed') return { send: false };
  return {
    send: true,
    subject: `First Light: ${name} edition failed`,
    body: `Today's ${name} edition failed.\n\nStatus: failed\nError: ${edition.error ?? '(none recorded)'}\n\n${RECOVER}`,
  };
}

export interface WatchdogDeps {
  now: () => Date;
  db: Db;
  send: (msg: MailMessage) => Promise<void>;
  print: (line: string) => void;
}

/** Runs at 6:17am and 4:47pm Sydney; the Sydney clock says which edition to check. */
export async function runWatchdog(deps: WatchdogDeps): Promise<void> {
  const now = deps.now();
  const slot: Slot = sydneyTime(now).endsWith('am') ? 'am' : 'pm';
  const [row] = await deps.db.query({
    text: `select status, error from editions where edition_date = $1 and slot = $2`,
    params: [sydneyDate(now), slot],
  });
  const edition = row ? { status: row['status'] as Edition['status'], error: (row['error'] as string | null) ?? null } : null;
  const decision = watchdogDecision(edition, slot);
  if (!decision.send) return deps.print('skipped');
  await deps.send({ subject: decision.subject, text: decision.body });
  deps.print('sent');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runOps(async () => {
    const mail = mailConfigFromEnv(process.env);
    await runWatchdog({
      now: () => new Date(),
      db: createSql(requireEnv(process.env, 'WATCHDOG_DATABASE_URL')),
      send: (msg) => sendMail(mail, msg),
      print: (line) => console.log(line),
    });
  });
}
