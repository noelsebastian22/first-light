import { pathToFileURL } from 'node:url';
import { sydneyDate } from '@first-light/contracts';
import type { Edition } from '@first-light/contracts';
import { createSql } from '../db';
import type { Db } from '../db';
import { mailConfigFromEnv, requireEnv, runOps, sendMail } from './mail';
import type { MailMessage } from './mail';
import type { MailDecision } from './watchdog';

/**
 * Spec §7: at 7:57am, if today's am edition is ok or partial and the app has
 * not been opened today, send the nudge, the Top 3 titles and a link. No story text.
 */
export function reminderDecision(
  am: { status: Edition['status']; nudge: string | null; topTitles: string[] } | null,
  openedToday: boolean,
  appUrl: string,
): MailDecision {
  if (am === null || am.status === 'failed' || openedToday) return { send: false };
  const lines = [
    ...(am.nudge ? [am.nudge, ''] : []),
    ...am.topTitles.map((title, i) => `${i + 1}. ${title}`),
    '',
    `${appUrl.replace(/\/$/, '')}/today`,
  ];
  return { send: true, subject: "Today's edition is ready", body: lines.join('\n') };
}

export interface ReminderDeps {
  now: () => Date;
  db: Db;
  appUrl: string;
  send: (msg: MailMessage) => Promise<void>;
  print: (line: string) => void;
}

export async function runReminder(deps: ReminderDeps): Promise<void> {
  const today = sydneyDate(deps.now());
  const [edition] = await deps.db.query({ text: `select id, status, nudge from editions where edition_date = $1 and slot = 'am'`, params: [today] });
  let am: Parameters<typeof reminderDecision>[0] = null;
  if (edition) {
    const top = await deps.db.query({
      text: `select title from stories where edition_id = $1 and top_rank is not null order by top_rank`,
      params: [edition['id']],
    });
    am = { status: edition['status'] as Edition['status'], nudge: (edition['nudge'] as string | null) ?? null, topTitles: top.map((r) => String(r['title'])) };
  }
  const [opens] = await deps.db.query({
    text: `select exists (select 1 from app_opens where (opened_at at time zone 'Australia/Sydney')::date = $1) as opened`,
    params: [today],
  });
  const decision = reminderDecision(am, opens?.['opened'] === true, deps.appUrl);
  if (!decision.send) return deps.print('skipped');
  await deps.send({ subject: decision.subject, text: decision.body });
  deps.print('sent');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runOps(async () => {
    const mail = mailConfigFromEnv(process.env);
    await runReminder({
      now: () => new Date(),
      db: createSql(requireEnv(process.env, 'WATCHDOG_DATABASE_URL')),
      appUrl: requireEnv(process.env, 'APP_URL'),
      send: (msg) => sendMail(mail, msg),
      print: (line) => console.log(line),
    });
  });
}
