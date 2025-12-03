import { describe, expect, it } from 'vitest';

import { buildSitemapUrls, renderSitemapXml } from '../src/services/sitemapService.js';

describe('sitemapService', () => {
  it('buildSitemapUrls returns static and problem entries', () => {
    const urls = buildSitemapUrls({
      origin: 'https://example.com',
      problems: [
        { problemId: 100001, updatedAt: new Date('2024-01-01T00:00:00.000Z') },
        { problemId: 100002, createdAt: new Date('2024-01-02T00:00:00.000Z') }
      ]
    });

    expect(urls.find((entry) => entry.loc === 'https://example.com')).toBeTruthy();
    const detail = urls.find((entry) => entry.loc === 'https://example.com/problems/100001');
    expect(detail?.lastmod).toBe('2024-01-01T00:00:00.000Z');
    expect(detail?.changefreq).toBe('weekly');
  });

  it('renderSitemapXml escapes XML entities and renders metadata', () => {
    const xml = renderSitemapXml([
      {
        loc: 'https://example.com/problems/1?foo=bar&baz=qux',
        lastmod: '2024-01-01T00:00:00.000Z',
        changefreq: 'weekly',
        priority: '0.8'
      }
    ]);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.trim().endsWith('</urlset>')).toBe(true);
    expect(xml).toContain(
      '<loc>https://example.com/problems/1?foo=bar&amp;baz=qux</loc>'
    );
    expect(xml).toContain('<changefreq>weekly</changefreq>');
    expect(xml).toContain('<priority>0.8</priority>');
  });
});
