import { Edition, ModelEdition, SECTIONS } from '@first-light/contracts';
import type { Candidate, CandidatesFile, KeyDate, ModelStory, Story, StoryLink, Weather } from '@first-light/contracts';

export interface ValidateContext {
  editionId: string;
  createdAt: string;
  weather: Weather;
  keyDates: KeyDate[];
  sourceCount: number;
  status: 'ok' | 'partial';
}

export type ValidateResult = { ok: true; edition: Edition } | { ok: false; errors: string[] };

/** Maximum characters per model-written field. */
export const LIMITS = { title: 120, summary: 400, whyItMatters: 220, pickedBecause: 160, nudge: 200 } as const;

const MAX_PER_SECTION = 4;
const STORY_TEXT_FIELDS = ['title', 'summary', 'whyItMatters', 'pickedBecause'] as const;

/** http(s) links and bare www.<host> addresses. */
const URL_PATTERN = /https?:\/\/|\bwww\.[a-z0-9-]+\.[a-z]/i;

/** Problems with one piece of model text, named by its path. */
function textErrors(path: string, text: string, max: number): string[] {
  const errors: string[] = [];
  const length = [...text].length;
  if (text.trim() === '') errors.push(`${path}: empty`);
  if (length > max) errors.push(`${path}: ${length} characters (max ${max})`);
  if (text.includes('<')) errors.push(`${path}: contains HTML`);
  if (URL_PATTERN.test(text)) errors.push(`${path}: contains a URL`);
  return errors;
}

function linkFrom(candidate: Candidate): StoryLink {
  return { sourceKey: candidate.sourceKey, url: candidate.url, publisherTitle: candidate.title, publishedAt: candidate.publishedAt };
}

/**
 * Checks Claude's edition against the candidates it was given and, if it passes,
 * builds the Edition with links attached from the cited candidates. The model
 * never supplies a URL; every error is a readable line Claude can act on in a retry.
 */
export function validateEdition(model: unknown, candidates: CandidatesFile, ctx: ValidateContext): ValidateResult {
  const parsed = ModelEdition.safeParse(model);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message)),
    };
  }
  const { stories, top3, nudge } = parsed.data;
  if (stories.length === 0) return { ok: false, errors: ['stories: the edition has no stories'] };

  const byId = new Map(candidates.candidates.map((c) => [c.id, c]));
  const errors: string[] = [];

  stories.forEach((story, i) => {
    for (const field of STORY_TEXT_FIELDS) errors.push(...textErrors(`stories[${i}].${field}`, story[field], LIMITS[field]));
    for (const id of story.articleIds) {
      if (!byId.has(id)) errors.push(`stories[${i}]: unknown article id ${id}`);
    }
  });

  for (const section of SECTIONS) {
    const count = stories.filter((s) => s.section === section).length;
    if (count > MAX_PER_SECTION) errors.push(`section ${section} has ${count} stories (max ${MAX_PER_SECTION})`);
  }

  if (candidates.slot === 'am') {
    if (nudge === null || nudge.trim() === '') errors.push('nudge: required in the morning edition');
    else errors.push(...textErrors('nudge', nudge, LIMITS.nudge));
    if (top3 === null || top3.length !== 3 || new Set(top3).size !== 3) {
      errors.push('top3: the morning edition needs exactly 3 distinct stories');
    }
    for (const index of top3 ?? []) {
      if (index >= stories.length) errors.push(`top3: index ${index} is not a story in this edition`);
    }
  } else {
    if (nudge !== null) errors.push('nudge: must be null in the afternoon edition');
    if (top3 !== null) errors.push('top3: must be null in the afternoon edition');
  }

  if (errors.length > 0) return { ok: false, errors };

  const edition: Edition = {
    id: ctx.editionId,
    editionDate: candidates.editionDate,
    slot: candidates.slot,
    status: ctx.status,
    createdAt: ctx.createdAt,
    nudge: candidates.slot === 'am' ? nudge : null,
    weather: ctx.weather,
    keyDates: ctx.keyDates,
    sourceCount: ctx.sourceCount,
    stories: buildStories(stories, top3 ?? [], byId, ctx.editionId),
  };

  // Last line of defence: whatever leaves here must be a valid Edition.
  const final = Edition.safeParse(edition);
  if (!final.success) return { ok: false, errors: final.error.issues.map((issue) => `edition.${issue.path.join('.')}: ${issue.message}`) };
  return { ok: true, edition: final.data };
}

function buildStories(stories: ModelStory[], top3: number[], byId: Map<string, Candidate>, editionId: string): Story[] {
  const rankInSection = new Map<string, number>();
  return stories.map((story, i) => {
    const rank = (rankInSection.get(story.section) ?? 0) + 1;
    rankInSection.set(story.section, rank);
    const topIndex = top3.indexOf(i);
    // A repeated article ID in one story yields one link, not two.
    const ids = [...new Set(story.articleIds)];
    return {
      id: `${editionId}-${String(i + 1).padStart(2, '0')}`,
      section: story.section,
      rank,
      topRank: topIndex === -1 ? null : ((topIndex + 1) as 1 | 2 | 3),
      title: story.title,
      summary: story.summary,
      whyItMatters: story.whyItMatters,
      pickedBecause: story.pickedBecause,
      links: ids.map((id) => linkFrom(byId.get(id) as Candidate)),
    };
  });
}
