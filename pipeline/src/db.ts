import { neon } from '@neondatabase/serverless';

/** One parameterised SQL statement. Values only ever travel in `params`. */
export interface Statement {
  text: string;
  params: unknown[];
}

/** Runs statements as one non-interactive transaction. */
export type SqlTx = (statements: Statement[]) => Promise<unknown>;

export interface Db {
  query(statement: Statement): Promise<Record<string, unknown>[]>;
  transaction: SqlTx;
}

/** Neon over HTTPS (`@neondatabase/serverless`). The routine has no other way in. */
export function createSql(url: string): Db {
  const sql = neon(url);
  return {
    query: async ({ text, params }) => (await sql.query(text, params)) as Record<string, unknown>[],
    transaction: (statements) => sql.transaction(statements.map(({ text, params }) => sql.query(text, params))),
  };
}

const iso = (value: unknown) => new Date(value as string | Date).toISOString();

/** Normalised URLs used by editions created in the last 48 hours (spec §5, step 2). */
export async function loadRecentUrls(db: Db, now: Date): Promise<Set<string>> {
  const since = new Date(now.getTime() - 48 * 3_600_000).toISOString();
  const rows = await db.query({
    text: `select l.url from story_links l
           join stories s on s.id = l.story_id
           join editions e on e.id = s.edition_id
           where e.created_at >= $1`,
    params: [since],
  });
  return new Set(rows.map((r) => String(r['url'])));
}

/** Today's am edition, for the pm run. Null when it is missing or failed: pm then runs as a full edition. */
export async function loadAmContext(db: Db, editionDate: string): Promise<{ createdAt: string; urls: Set<string>; titles: string[] } | null> {
  const [am] = await db.query({
    text: `select id, status, created_at from editions where edition_date = $1 and slot = 'am'`,
    params: [editionDate],
  });
  if (!am || am['status'] === 'failed') return null;
  const stories = await db.query({ text: `select title from stories where edition_id = $1 order by section, rank`, params: [am['id']] });
  const links = await db.query({
    text: `select l.url from story_links l join stories s on s.id = l.story_id where s.edition_id = $1`,
    params: [am['id']],
  });
  return {
    createdAt: iso(am['created_at']),
    urls: new Set(links.map((r) => String(r['url']))),
    titles: stories.map((r) => String(r['title'])),
  };
}

/** Status of the edition already stored for a date and slot, if any. */
export async function loadExisting(db: Db, editionDate: string, slot: string): Promise<{ status: string } | null> {
  const [row] = await db.query({ text: `select status from editions where edition_date = $1 and slot = $2`, params: [editionDate, slot] });
  return row ? { status: String(row['status']) } : null;
}
