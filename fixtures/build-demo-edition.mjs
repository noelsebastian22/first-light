// Builds fixtures/demo-edition.json — the hand-written sample edition used by the
// public demo. Run: node fixtures/build-demo-edition.mjs
// Content is written for the demo: scheduled dates and widely reported figures,
// plus generic explainers for politics and world (no invented events).
import { writeFileSync } from 'node:fs';

const link = (sourceKey, publisherTitle, url, publishedAt = '2026-10-12T19:00:00Z') => ({
  sourceKey,
  url,
  publisherTitle,
  publishedAt,
});

const place = (name, nowC, lowC, highC, normalLowC, normalHighC, summary, rain, wind, hourly) => ({
  name,
  nowC,
  highC,
  lowC,
  normalHighC,
  normalLowC,
  summary,
  rainChancePct: rain,
  windKmh: wind,
  sunrise: '05:50',
  hourly: hourly.map(([time, tempC]) => ({ time, tempC })),
});

const weather = {
  katoomba: place('Katoomba', 9, 7, 17, 8, 18, 'Fog lifting around 10am', 20, 12, [
    ['06:00', 8],
    ['09:00', 10],
    ['12:00', 15],
    ['15:00', 17],
    ['18:00', 13],
  ]),
  sydney: place('Sydney CBD', 16, 14, 22, 13, 22, 'Clear', 5, 15, [
    ['06:00', 14],
    ['09:00', 17],
    ['12:00', 21],
    ['15:00', 22],
    ['18:00', 19],
  ]),
};

const keyDates = [
  { date: '2026-10-15', timeLocal: '11:30', label: 'Labour Force', sourceName: 'ABS', url: 'https://www.abs.gov.au/release-calendar/future-releases' },
  { date: '2026-10-28', timeLocal: '11:30', label: 'CPI, September quarter', sourceName: 'ABS', url: 'https://www.abs.gov.au/release-calendar/future-releases' },
  { date: '2026-11-03', timeLocal: '14:30', label: 'RBA cash rate decision', sourceName: 'RBA', url: 'https://www.rba.gov.au/schedules-events/board-meeting-schedules.html' },
];

let n = 0;
const story = (section, rank, topRank, title, summary, whyItMatters, pickedBecause, links) => ({
  id: `demo-${String(++n).padStart(3, '0')}`,
  section,
  rank,
  topRank,
  title,
  summary,
  whyItMatters,
  pickedBecause,
  links,
});

const ABS = link('abs', 'ABS release calendar', 'https://www.abs.gov.au/release-calendar/future-releases');
const RBA = link('rba', 'Reserve Bank of Australia', 'https://www.rba.gov.au/media-releases/');
const ABC_POL = link('abc-politics', 'ABC News: Politics', 'https://www.abc.net.au/news/politics');
const SBS_AU = link('sbs-australia', 'SBS News: Australia', 'https://www.sbs.com.au/news/topic/australia');
const CONV = link('conversation-politics', 'The Conversation: Politics', 'https://theconversation.com/au/politics');
const ABC_WORLD = link('abc-world', 'ABC News: World', 'https://www.abc.net.au/news/world');
const SBS_WORLD = link('sbs-world', 'SBS News: World', 'https://www.sbs.com.au/news/topic/world');
const ANGULAR = link('angular-blog', 'Angular Blog', 'https://blog.angular.dev/');
const ANGULAR_REL = link('angular-dev', 'Angular release schedule', 'https://angular.dev/reference/releases');
const SER = link('seroundtable', 'Search Engine Roundtable', 'https://www.seroundtable.com/');
const SOJS = link('state-of-js', 'State of JavaScript 2025', 'https://2025.stateofjs.com/');
const SMOL = link('smol-ai', 'AI News by smol.ai', 'https://news.smol.ai/');
const WILLISON = link('simonw', 'Simon Willison', 'https://simonwillison.net/');
const ITNEWS = link('itnews', 'iTnews', 'https://www.itnews.com.au/');
const STARTUP = link('startup-daily', 'Startup Daily', 'https://www.startupdaily.net/');

const amStories = [
  story('au-economy', 1, 1, 'September-quarter CPI lands 28 October',
    'The ABS publishes quarterly inflation on Wednesday 28 October at 11:30am. It is the last major inflation reading before the RBA board meets on 2 and 3 November.',
    'Rates move on this number. Anything with a variable rate, a refinance or a fixed-rate expiry is worth watching from here.',
    'Scheduled primary-source release that feeds directly into the next rate decision.',
    [ABS, RBA]),
  story('au-economy', 2, null, 'Labour Force figures due Thursday',
    'September jobs data comes out on 15 October. The unemployment rate is one of the two numbers the RBA leans on most.',
    'A surprise here shifts expectations for November before CPI does.',
    'Primary-source release in the next seven days.',
    [ABS]),
  story('au-economy', 3, null, 'RBA board meets 2 and 3 November',
    'The November meeting comes with the quarterly Statement on Monetary Policy, so it brings new forecasts as well as a decision.',
    'The forecasts say where rates are heading over the next year, not just next month.',
    'Primary source with a fixed date.',
    [RBA]),
  story('au-politics', 1, null, 'How a bill becomes law: the spring sittings explained',
    'Parliament sits in blocks through spring. Bills pass both houses before the Governor-General gives assent, and Senate committees often slow them down.',
    'Policy that touches housing, tax or tech rarely changes overnight; the sitting calendar tells you when it can.',
    'A useful explainer while the sitting calendar is busy.',
    [ABC_POL, CONV]),
  story('au-politics', 2, null, 'Where housing supply policy is made',
    'Federal targets set the direction, but zoning and approvals sit with the states and councils, which is why progress varies so much by city.',
    'Explains why Melbourne and Sydney can move at different speeds on the same national target.',
    'Background that helps read housing headlines.',
    [SBS_AU, CONV]),
  story('world', 1, null, 'Why US interest rates still matter here',
    'When the US Federal Reserve moves, the Australian dollar and global borrowing costs tend to follow, which feeds into local prices and bank funding.',
    'A weaker dollar makes imported tech and travel dearer.',
    'Context for reading global rate news.',
    [ABC_WORLD]),
  story('world', 2, null, 'Trade with Asia: the numbers behind the headlines',
    'China, Japan and South Korea remain Australia’s largest export markets, so their growth and policy settings show up in the federal budget.',
    'Commodity export income is a big swing factor in budget forecasts.',
    'Explainer that frames recurring trade stories.',
    [SBS_WORLD]),
  story('web-dev', 1, 2, 'Angular v20 leaves long-term support in November',
    'Each Angular major gets 18 months of support: six active and twelve LTS. v20 reaches the end of that window next month, after which security fixes stop.',
    'Any app still on v20, at work or for a client, should have an upgrade ticket before the end of the year.',
    'Angular is your main framework and support dates are high signal.',
    [ANGULAR_REL]),
  story('web-dev', 2, null, 'Signal Forms are stable as of Angular v22',
    'Signal Forms, resource and httpResource moved to stable in v22, and new apps now default to OnPush change detection.',
    'Safe to use in production code now, not just side projects.',
    'Direct match on Angular and signals.',
    [ANGULAR]),
  story('web-dev', 3, null, 'Core updates keep reshuffling small-business search results',
    'Google confirmed several core updates this year. Sites with thin service pages tend to lose ground; specific, local pages tend to hold up.',
    'Worth checking client sites’ service pages before the next update lands.',
    'Search changes affect your freelance clients.',
    [SER]),
  story('ai', 1, 3, 'Google AI Mode passes a billion monthly users',
    'Google says AI Mode now has more than a billion monthly users, alongside this year’s core updates to regular search.',
    'Fewer clicks reach small-business sites. Pitch clients on being the cited answer, not just a blue link.',
    'Touches both AI and your freelance work.',
    [SER, SMOL]),
  story('ai', 2, null, 'State of JS: Claude use among respondents doubles to 44%',
    'The 2025 survey found 29% of respondents’ code is AI-generated, and Claude use rose from 22% to 44%.',
    'Useful numbers for interviews and client conversations about AI-assisted delivery.',
    'Developer-tooling data from a large survey.',
    [SOJS, WILLISON]),
  story('au-tech-market', 1, null, 'Developer workforce at a record 216,000',
    'An analysis of ABS data puts Australia’s software developer workforce at 216,000 in February, up from 189,000 a year earlier.',
    'More competition for roles, and more teams that need seniors to lead them.',
    'Matches your interest in the local tech market.',
    [ITNEWS]),
  story('au-tech-market', 2, null, 'Startups lean on AI to stay small',
    'Local founders report hiring fewer juniors and more senior generalists who can direct AI tools across the stack.',
    'Senior frontend skills plus AI fluency is the profile in demand.',
    'Recurring theme across local startup coverage.',
    [STARTUP]),
];

const pmStories = [
  story('au-economy', 1, null, 'Update: what economists expect from CPI',
    'Bank economists published their September-quarter previews this afternoon. Most expect underlying inflation to edge lower but stay above the RBA’s target band.',
    'If the print lands above previews, a November move becomes more likely.',
    'New since the morning and adds to the CPI story.',
    [ABS]),
  story('web-dev', 1, null, 'Chrome lands a new Baseline batch',
    'Chrome’s latest stable release moves more CSS and DOM features into Baseline “newly available”.',
    'More features you can use without polyfills in client sites.',
    'New since the morning; browser platform changes.',
    [link('chrome-dev', 'Chrome for Developers', 'https://developer.chrome.com/blog', '2026-10-13T03:00:00Z')]),
  story('ai', 1, null, 'Coding agents get scheduled runs',
    'More AI coding tools now run unattended jobs on a schedule, such as nightly reviews and morning reports.',
    'This app is built on the same idea.',
    'New since the morning; AI developer tooling.',
    [WILLISON]),
];

const am = {
  id: 'demo-2026-10-13-am',
  editionDate: '2026-10-13',
  slot: 'am',
  status: 'ok',
  createdAt: '2026-10-12T18:31:00Z',
  nudge: 'A quiet news day. The big one is CPI on 28 October, so if there is deep work you have been putting off, this is the week to do it.',
  weather,
  keyDates,
  sourceCount: 41,
  stories: amStories,
};

const pm = {
  id: 'demo-2026-10-13-pm',
  editionDate: '2026-10-13',
  slot: 'pm',
  status: 'ok',
  createdAt: '2026-10-13T05:03:00Z',
  nudge: null,
  weather,
  keyDates,
  sourceCount: 39,
  stories: pmStories,
};

const archiveDays = [
  ['2026-10-12', 'am', [
    ['au-economy', 'RBA minutes point to a data-dependent November', 'The minutes of the last board meeting stress that the next decision depends on the coming inflation and jobs data.', [RBA]],
    ['web-dev', 'TypeScript 6 is the floor for Angular 22', 'Angular 22 requires TypeScript 6.0, so older toolchains need upgrading before a move to v22.', [ANGULAR]],
    ['ai', 'Agents that review their own pull requests', 'More teams are wiring AI review into CI so every change gets a first pass before a human looks.', [WILLISON]],
  ]],
  ['2026-10-09', 'am', [
    ['au-tech-market', 'Contract rates for senior frontend roles hold steady', 'Recruiters report steady day rates for senior Angular and React contractors in Sydney and Melbourne.', [ITNEWS]],
    ['au-economy', 'Household spending data due next week', 'The ABS monthly household spending indicator gives an early read on how rate rises are biting.', [ABS]],
  ]],
  ['2026-10-08', 'pm', [
    ['web-dev', 'View transitions keep spreading across browsers', 'Cross-document view transitions now work in more browsers, making page-to-page animation possible without a framework.', [link('chrome-dev', 'Chrome for Developers', 'https://developer.chrome.com/blog', '2026-10-08T03:00:00Z')]],
    ['ai', 'Smaller models, cheaper summaries', 'Labs keep shipping small models that summarise well, which keeps the cost of daily digests falling.', [SMOL]],
  ]],
  ['2026-10-07', 'am', [
    ['au-politics', 'Senate committees: where bills slow down', 'Committee inquiries let the Senate test a bill in detail, which is where most amendments start.', [CONV]],
    ['world', 'Why global shipping costs reach your shelves', 'Freight rates feed into import prices with a lag of a few months, so shipping news is an early inflation signal.', [ABC_WORLD]],
    ['web-dev', 'Angular’s support windows explained', 'Each major version gets six months of active support and twelve of LTS, which sets the upgrade rhythm for teams.', [ANGULAR_REL]],
  ]],
  ['2026-10-05', 'am', [
    ['au-economy', 'The RBA’s target band in plain terms', 'The Reserve Bank aims to keep inflation between 2 and 3 per cent on average, which is why each CPI print matters.', [RBA]],
    ['ai', 'Claude Code routines run on a schedule', 'Routines let a Claude Code session run on a timetable in the cloud, which is how this app’s editions are made.', [WILLISON]],
  ]],
  ['2026-10-02', 'am', [
    ['ai', 'State of JS 2025: AI writes more of the code', 'Respondents say 29% of their code is now AI-generated, up sharply on the year before.', [SOJS]],
    ['au-tech-market', 'Where the developer jobs are', 'Sydney and Melbourne still hold most developer roles, but remote-first teams are spreading them further.', [STARTUP]],
  ]],
];

const archive = archiveDays.map(([date, slot, items], i) => ({
  id: `demo-${date}-${slot}`,
  editionDate: date,
  slot,
  status: 'ok',
  createdAt: slot === 'am' ? `${date}T05:31:00+11:00` : `${date}T16:03:00+11:00`,
  nudge: slot === 'am' ? 'Steady day. Nothing scheduled that changes your plans.' : null,
  weather,
  keyDates: [],
  sourceCount: 38 + i,
  stories: items.map(([section, title, summary, links], j) =>
    story(section, j + 1, null, title, summary, 'Background worth keeping in mind.', 'Archive sample.', links),
  ),
}));

writeFileSync(new URL('./demo-edition.json', import.meta.url), JSON.stringify({ am, pm, archive }, null, 2) + '\n');
console.log('wrote demo-edition.json');
