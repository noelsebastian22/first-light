/** Zod-free section constants, safe to import from the browser bundle. */
export const SECTIONS = ['au-economy', 'au-politics', 'world', 'web-dev', 'ai', 'au-tech-market'] as const;
export type SectionKey = (typeof SECTIONS)[number];

export const SECTION_META: Record<SectionKey, { label: string; fill: string }> = {
  'au-economy': { label: 'AU economy', fill: '#FBE3CC' },
  'au-politics': { label: 'AU politics', fill: '#E4DDF3' },
  world: { label: 'World', fill: '#D9EEE6' },
  'web-dev': { label: 'Web dev', fill: '#DCE7F2' },
  ai: { label: 'AI', fill: '#F6E7B8' },
  'au-tech-market': { label: 'AU tech market', fill: '#F0DADA' },
};

export const MAX_STORIES_PER_SECTION = 4;
