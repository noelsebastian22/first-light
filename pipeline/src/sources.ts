import type { SectionKey } from '@first-light/contracts';

/**
 * The feed list. Code, not a table (spec §4). `section` is a hint for the
 * editor; Claude places each story in its final section.
 *
 * Week one: run `npm run pipeline:feeds-check` from a routine session and set
 * `active: false` on any feed that blocks cloud requests.
 */
export interface Source {
  key: string;
  name: string;
  url: string;
  section: SectionKey;
  active: boolean;
}

export const SOURCES: Source[] = [
  // AU economy
  { key: 'rba-media', name: 'Reserve Bank of Australia', url: 'https://www.rba.gov.au/rss/rss-cb-media-releases.xml', section: 'au-economy', active: true },
  { key: 'rba-speeches', name: 'RBA speeches', url: 'https://www.rba.gov.au/rss/rss-cb-speeches.xml', section: 'au-economy', active: true },
  { key: 'abc-business', name: 'ABC News Business', url: 'https://www.abc.net.au/news/feed/104217374/rss.xml', section: 'au-economy', active: true },
  { key: 'conversation-business', name: 'The Conversation', url: 'https://theconversation.com/au/business/articles.atom', section: 'au-economy', active: true },

  // AU politics
  { key: 'abc-politics', name: 'ABC News Politics', url: 'https://www.abc.net.au/news/feed/104217372/rss.xml', section: 'au-politics', active: true },
  { key: 'abc-top', name: 'ABC News', url: 'https://www.abc.net.au/news/feed/10719986/rss.xml', section: 'au-politics', active: true },
  { key: 'sbs-australia', name: 'SBS News', url: 'https://www.sbs.com.au/news/topic/australia/feed', section: 'au-politics', active: true },
  { key: 'conversation-politics', name: 'The Conversation', url: 'https://theconversation.com/au/politics/articles.atom', section: 'au-politics', active: true },

  // World
  { key: 'abc-world', name: 'ABC News World', url: 'https://www.abc.net.au/news/feed/104217382/rss.xml', section: 'world', active: true },
  { key: 'sbs-world', name: 'SBS News World', url: 'https://www.sbs.com.au/news/topic/world/feed', section: 'world', active: true },

  // Web dev (search and SEO folded in)
  { key: 'js-weekly', name: 'JavaScript Weekly', url: 'https://cprss.s3.amazonaws.com/javascriptweekly.com.xml', section: 'web-dev', active: true },
  { key: 'frontend-focus', name: 'Frontend Focus', url: 'https://cprss.s3.amazonaws.com/frontendfoc.us.xml', section: 'web-dev', active: true },
  { key: 'angular-blog', name: 'Angular Blog', url: 'https://blog.angular.dev/feed', section: 'web-dev', active: true },
  { key: 'chrome-dev', name: 'Chrome for Developers', url: 'https://developer.chrome.com/static/blog/feed.xml', section: 'web-dev', active: true },
  { key: 'se-roundtable', name: 'Search Engine Roundtable', url: 'https://www.seroundtable.com/index.xml', section: 'web-dev', active: true },
  { key: 'hn-front', name: 'Hacker News', url: 'https://hnrss.org/frontpage?points=150', section: 'web-dev', active: true },

  // AI
  { key: 'smol-ai', name: 'AI News (smol.ai)', url: 'https://news.smol.ai/rss.xml', section: 'ai', active: true },
  { key: 'simon-willison', name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', section: 'ai', active: true },
  { key: 'techmeme', name: 'Techmeme', url: 'https://www.techmeme.com/feed.xml', section: 'ai', active: true },

  // AU tech market
  { key: 'itnews', name: 'iTnews', url: 'https://www.itnews.com.au/RSS/rss.ashx', section: 'au-tech-market', active: true },
  { key: 'startup-daily', name: 'Startup Daily', url: 'https://www.startupdaily.net/feed/', section: 'au-tech-market', active: true },
];
