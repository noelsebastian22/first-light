import { z } from 'zod';
import { SECTIONS } from './sections-meta';

export { SECTIONS, SECTION_META, MAX_STORIES_PER_SECTION } from './sections-meta';

export const SectionKey = z.enum(SECTIONS);
export type SectionKey = z.infer<typeof SectionKey>;
