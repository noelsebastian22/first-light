import { createTransport } from 'nodemailer';

export interface MailConfig {
  user: string;
  pass: string;
  to: string;
}

export interface MailMessage {
  subject: string;
  text: string;
}

/** Gmail SMTP with an app password (needs 2-Step Verification on the account). */
export async function sendMail(cfg: MailConfig, msg: MailMessage): Promise<void> {
  const transport = createTransport({ service: 'gmail', auth: { user: cfg.user, pass: cfg.pass } });
  await transport.sendMail({ from: `First Light <${cfg.user}>`, to: cfg.to, subject: msg.subject, text: msg.text });
}

/** Reads a required variable. The message names the variable, never its value. */
export function requireEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function mailConfigFromEnv(env: Record<string, string | undefined>): MailConfig {
  return { user: requireEnv(env, 'GMAIL_USER'), pass: requireEnv(env, 'GMAIL_APP_PASSWORD'), to: requireEnv(env, 'MAIL_TO') };
}

/**
 * Entry point for a workflow script. Public logs carry only `sent`, `skipped`
 * or `error`: never a query result, a headline or a raw error (spec §7).
 */
export async function runOps(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch {
    console.log('error');
    process.exitCode = 1;
  }
}
