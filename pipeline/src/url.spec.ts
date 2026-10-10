import { describe, expect, it } from 'vitest';
import { normaliseUrl } from './url';

describe('normaliseUrl', () => {
  it('lower-cases the host and drops tracking parameters, fragments and the trailing slash', () => {
    expect(normaliseUrl('https://WWW.Example.COM/News/Story/?utm_source=rss&utm_medium=feed&id=7&fbclid=x&gclid=y#top'))
      .toBe('https://www.example.com/News/Story?id=7');
  });

  it('keeps the root path as a single slash', () => {
    expect(normaliseUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('drops a query that only held tracking parameters', () => {
    expect(normaliseUrl('https://example.com/a/?utm_campaign=z')).toBe('https://example.com/a');
  });

  it('upgrades nothing and keeps http as http', () => {
    expect(normaliseUrl('http://example.com/a')).toBe('http://example.com/a');
  });

  it('throws on something that is not a URL', () => {
    expect(() => normaliseUrl('not a url')).toThrow();
  });
});
