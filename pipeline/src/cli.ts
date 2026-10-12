import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { CandidatesFile, Edition, EditionStatus, KeyDate, SECTIONS, Slot, Weather, sydneyDate, sydneyTime } from '@first-light/contracts';
import { createSql, loadAmContext, loadExisting, loadRecentUrls } from './db';
import type { Db } from './db';
import { fetchAllFeeds } from './fetch/feeds';
import { fetchWeather } from './fetch/weather';
import type { WeatherNormals } from './fetch/weather';
import { loadKeyDates } from './key-dates';
import { prepare } from './prepare';
import { SOURCES } from './sources';
import type { Source } from './sources';
import { validateEdition } from './validate';
import { buildFailStatement, buildWriteStatements, planWrite } from './write';

export interface CliDeps {
  env: Record<string, string | undefined>;
  /** Where candidates.json, context.json, edition.json and validated.json live. */
  outDir: string;
  now: () => Date;
  fetch: typeof fetch;
  print: (line: string) => void;
  connect: (url: string) => Db;
}

/** Exit codes: 0 ok, 1 validation errors, 2 infrastructure error. */
type ExitCode = 0 | 1 | 2;

class CliError extends Error {
  constructor(
    message: string,
    readonly code: 1 | 2,
  ) {
    super(message);
  }
}

const ROOT = new URL('../../', import.meta.url);
const repoFile = (path: string) => readFileSync(new URL(path, ROOT), 'utf8');

/** What fetch learned that the edition needs but Claude never sees. */
const RunContext = z.object({
  editionId: z.string(),
  editionDate: z.string(),
  slot: Slot,
  createdAt: z.string().datetime({ offset: true }),
  weather: Weather,
  keyDates: z.array(KeyDate),
  sourceCount: z.number().int().min(0),
  status: z.enum(['ok', 'partial']),
  failedFeeds: z.array(z.object({ key: z.string(), reason: z.string() })),
});
type RunContext = z.infer<typeof RunContext>;

const editionIdFor = (editionDate: string, slot: Slot) => `ed-${editionDate}-${slot}`;

function readOut<T>(deps: CliDeps, name: string, schema: z.ZodType<T>): T {
  let raw: string;
  try {
    raw = readFileSync(join(deps.outDir, name), 'utf8');
  } catch {
    throw new CliError(`${name} not found in ${deps.outDir}: run the earlier step first`, 2);
  }
  const parsed = schema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new CliError(`${name} is not in the expected shape`, 2);
  return parsed.data;
}

function writeOut(deps: CliDeps, name: string, value: unknown): void {
  mkdirSync(deps.outDir, { recursive: true });
  writeFileSync(join(deps.outDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

function database(deps: CliDeps): Db {
  const url = deps.env['DATABASE_URL'];
  if (!url) throw new CliError('DATABASE_URL is not set', 2);
  return deps.connect(url);
}

/** Steps 1 and 2: fetch everything and write the candidates Claude edits from. */
async function gather(deps: CliDeps, slot: Slot, now: Date, sources: Source[], fetchImpl: typeof fetch, db: Db | null): Promise<void> {
  const editionDate = sydneyDate(now);
  const normals = JSON.parse(repoFile('pipeline/weather-normals.json')) as WeatherNormals;
  const [feeds, weather] = await Promise.all([fetchAllFeeds(sources, fetchImpl), fetchWeather(fetchImpl, normals, editionDate)]);
  const keyDates = loadKeyDates(repoFile('pipeline/key-dates.yaml'), editionDate);

  const recentUrls = db ? await loadRecentUrls(db, now, editionDate, slot) : new Set<string>();
  const am = db && slot === 'pm' ? await loadAmContext(db, editionDate) : null;
  const candidates = prepare({ items: feeds.items, slot, editionDate, now, recentUrls, am });

  const context: RunContext = {
    editionId: editionIdFor(editionDate, slot),
    editionDate,
    slot,
    createdAt: now.toISOString(),
    weather,
    keyDates: keyDates.dates,
    sourceCount: sources.filter((s) => s.active).length - feeds.failed.length,
    status: feeds.failed.length > 0 ? 'partial' : 'ok',
    failedFeeds: feeds.failed,
  };
  writeOut(deps, 'candidates.json', candidates);
  writeOut(deps, 'context.json', context);

  for (const f of feeds.failed) deps.print(`feed skipped: ${f.key}: ${f.reason}`);
  if (keyDates.warning) deps.print(`warning: ${keyDates.warning}`);
  if (slot === 'pm' && db && !am) deps.print('no usable am edition today: write a full edition (Top 3 and nudge stay null)');
  const counts = SECTIONS.map((s) => `${s} ${candidates.candidates.filter((c) => c.sectionHint === s).length}`).join(', ');
  deps.print(`ok: ${candidates.candidates.length} candidates for ${context.editionId} (${counts})`);
}

/** Step 4: check out/edition.json; on success write out/validated.json. */
function validate(deps: CliDeps): ExitCode {
  const candidates = readOut(deps, 'candidates.json', CandidatesFile);
  const ctx = readOut(deps, 'context.json', RunContext);
  let model: unknown;
  try {
    model = JSON.parse(readFileSync(join(deps.outDir, 'edition.json'), 'utf8'));
  } catch (error) {
    // Claude wrote this file, so a parse error is something it can fix on retry.
    const missing = error instanceof Error && 'code' in error && error.code === 'ENOENT';
    if (missing) throw new CliError(`edition.json not found in ${deps.outDir}`, 2);
    deps.print('edition.json: not valid JSON');
    return 1;
  }
  const result = validateEdition(model, candidates, ctx);
  if (!result.ok) {
    for (const line of result.errors) deps.print(line);
    return 1;
  }
  writeOut(deps, 'validated.json', result.edition);
  deps.print('ok');
  return 0;
}

/** Step 5. */
async function write(deps: CliDeps, force: boolean): Promise<ExitCode> {
  const edition = readOut(deps, 'validated.json', Edition);
  const db = database(deps);
  const existing = await loadExisting(db, edition.editionDate, edition.slot);
  const plan = planWrite(existing ? { status: EditionStatus.parse(existing.status) } : null, force);
  if (plan === 'refuse') {
    deps.print(`skipped: ${edition.id} is already written with status ok (use --force to replace it)`);
    return 0;
  }
  await db.transaction(buildWriteStatements(edition));
  deps.print(`ok: ${plan === 'insert' ? 'wrote' : 'replaced'} ${edition.id} (${edition.status}, ${edition.stories.length} stories)`);
  return 0;
}

const MAX_ERROR = 1000;

/** Step 6: the run gave up. Record why, against today's edition for this slot. */
async function fail(deps: CliDeps, message: string | undefined): Promise<ExitCode> {
  if (!message?.trim()) throw new CliError('usage: fail "<step>: <error>"', 2);
  const now = deps.now();
  let target: { editionId: string; editionDate: string; slot: Slot };
  try {
    target = readOut(deps, 'context.json', RunContext);
  } catch {
    // fetch never got far enough to write context.json: name the slot from the Sydney clock.
    const slot: Slot = sydneyTime(now).endsWith('am') ? 'am' : 'pm';
    const editionDate = sydneyDate(now);
    target = { editionId: editionIdFor(editionDate, slot), editionDate, slot };
  }
  const db = database(deps);
  const statement = buildFailStatement({ ...target, error: message.trim().slice(0, MAX_ERROR), at: now });
  await db.transaction([statement]);
  deps.print(`ok: recorded failure for ${target.editionId}`);
  return 0;
}

/** Week one: which feeds answer from this environment. */
async function feedsCheck(deps: CliDeps): Promise<ExitCode> {
  const { items, failed } = await fetchAllFeeds(SOURCES, deps.fetch);
  for (const source of SOURCES) {
    const failure = failed.find((f) => f.key === source.key);
    if (!source.active) deps.print(`inactive  ${source.key}`);
    else if (failure) deps.print(`failed    ${source.key}: ${failure.reason}`);
    else deps.print(`ok        ${source.key} (${items.filter((i) => i.sourceKey === source.key).length} items)`);
  }
  return 0;
}

/** The fixtures are dated 12 October 2026; this is 5:32am Sydney the next morning. */
const DEMO_NOW = new Date('2026-10-12T18:32:00.000Z');

const DEMO_SOURCES: Source[] = [
  { key: 'sample-economy', name: 'Sample Economy Desk', url: 'https://fixtures.invalid/rss-sample.xml', section: 'au-economy', active: true },
  { key: 'sample-dev', name: 'Sample Dev Blog', url: 'https://fixtures.invalid/atom-sample.xml', section: 'web-dev', active: true },
];

/** Serves the repo fixtures in place of the network. */
const fixtureFetch = (async (input: string | URL | Request) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === 'api.open-meteo.com') {
    const place = url.searchParams.get('latitude') === '-33.71' ? 'katoomba' : 'sydney';
    return new Response(repoFile(`fixtures/open-meteo/${place}.json`));
  }
  return new Response(repoFile(`fixtures/feeds${url.pathname}`));
}) as typeof fetch;

/** Local smoke test: fixtures in, the sample model edition as Claude's answer, no database. */
async function demoRun(deps: CliDeps): Promise<ExitCode> {
  await gather(deps, 'am', DEMO_NOW, DEMO_SOURCES, fixtureFetch, null);
  writeOut(deps, 'edition.json', JSON.parse(repoFile('fixtures/model-edition.sample.json')));
  return validate(deps);
}

export async function runCli(argv: string[], deps: CliDeps): Promise<ExitCode> {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case 'fetch': {
        const { values } = parseArgs({ args: rest, options: { slot: { type: 'string' } } });
        const slot = Slot.safeParse(values.slot);
        if (!slot.success) throw new CliError('usage: fetch --slot am|pm', 2);
        const url = deps.env['DATABASE_URL'];
        await gather(deps, slot.data, deps.now(), SOURCES, deps.fetch, url ? deps.connect(url) : null);
        return 0;
      }
      case 'validate':
        return validate(deps);
      case 'write': {
        const { values } = parseArgs({ args: rest, options: { force: { type: 'boolean', default: false } } });
        return await write(deps, values.force);
      }
      case 'fail':
        return await fail(deps, rest.join(' '));
      case 'feeds-check':
        return await feedsCheck(deps);
      case 'demo-run':
        return await demoRun(deps);
      default:
        throw new CliError(`unknown command ${command ?? '(none)'}: use fetch, validate, write, fail, feeds-check or demo-run`, 2);
    }
  } catch (error) {
    deps.print(`error: ${error instanceof Error ? error.message : String(error)}`);
    return error instanceof CliError ? error.code : 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli(process.argv.slice(2), {
    env: process.env,
    outDir: fileURLToPath(new URL('../out/', import.meta.url)),
    now: () => new Date(),
    fetch,
    print: (line) => console.log(line),
    connect: createSql,
  });
}
