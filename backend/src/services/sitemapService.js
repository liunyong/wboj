import Problem from '../models/Problem.js';

const STATIC_PAGES = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/problems', changefreq: 'hourly', priority: 0.9 },
  { path: '/submissions', changefreq: 'hourly', priority: 0.7 },
  { path: '/docs', changefreq: 'weekly', priority: 0.4 }
];

const DEFAULT_SITE_URL = 'https://wboj.app';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

const stripTrailingSlash = (value = '') => value.replace(/\/+$/, '');

const ensureLeadingSlash = (value = '/') => (value.startsWith('/') ? value : `/${value}`);

const resolveCacheTtl = () => {
  const parsed = Number.parseInt(process.env.SITEMAP_CACHE_TTL_MS ?? '', 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_CACHE_TTL_MS;
};

const SITEMAP_CACHE_TTL_MS = resolveCacheTtl();

const resolveSiteOrigin = () => {
  const candidate =
    process.env.SITEMAP_BASE_URL ||
    process.env.FRONTEND_ORIGIN ||
    process.env.VITE_SITE_URL ||
    DEFAULT_SITE_URL;

  try {
    const url = new URL(candidate);
    return url.origin;
  } catch (_error) {
    const normalized = stripTrailingSlash(candidate.trim() || DEFAULT_SITE_URL);
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      return normalized;
    }
    return `https://${normalized}`;
  }
};

const buildAbsoluteUrl = (origin, path) => {
  if (path === '/' || path === '') {
    return origin;
  }
  return `${origin}${ensureLeadingSlash(path)}`;
};

const formatIsoDate = (value) => {
  if (!value) {
    return undefined;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
};

const escapeXml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const buildStaticEntries = (origin) =>
  STATIC_PAGES.map((page) => ({
    loc: buildAbsoluteUrl(origin, page.path),
    changefreq: page.changefreq,
    priority: page.priority.toFixed(1)
  }));

const buildProblemEntries = (problems, origin) =>
  problems
    .filter((problem) => Number.isFinite(problem?.problemId))
    .map((problem) => ({
      loc: buildAbsoluteUrl(origin, `/problems/${problem.problemId}`),
      lastmod: formatIsoDate(problem.updatedAt || problem.createdAt),
      changefreq: 'weekly',
      priority: '0.8'
    }));

export const buildSitemapUrls = ({ origin = resolveSiteOrigin(), problems = [] } = {}) => {
  const staticEntries = buildStaticEntries(origin);
  const problemEntries = buildProblemEntries(problems, origin);
  return [...staticEntries, ...problemEntries];
};

export const renderSitemapXml = (urls = []) => {
  const safeUrls = urls.filter((url) => url && url.loc);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  ];

  safeUrls.forEach((url) => {
    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(url.loc)}</loc>`);
    if (url.lastmod) {
      lines.push(`    <lastmod>${escapeXml(url.lastmod)}</lastmod>`);
    }
    if (url.changefreq) {
      lines.push(`    <changefreq>${escapeXml(url.changefreq)}</changefreq>`);
    }
    if (url.priority) {
      lines.push(`    <priority>${escapeXml(url.priority)}</priority>`);
    }
    lines.push('  </url>');
  });

  lines.push('</urlset>');
  return lines.join('\n');
};

const fetchPublicProblems = async () =>
  Problem.find(
    { isPublic: true },
    { problemId: 1, updatedAt: 1, createdAt: 1, problemNumber: 1 }
  )
    .sort({ problemNumber: 1, problemId: 1 })
    .lean();

const generateSitemapXml = async () => {
  const problems = await fetchPublicProblems();
  const urls = buildSitemapUrls({ problems });
  return renderSitemapXml(urls);
};

let cachedSitemap = null;
let cacheExpiresAt = 0;

export const getSitemapXml = async () => {
  const now = Date.now();
  if (cachedSitemap && cacheExpiresAt > now) {
    return cachedSitemap;
  }
  const xml = await generateSitemapXml();
  cachedSitemap = xml;
  cacheExpiresAt = now + SITEMAP_CACHE_TTL_MS;
  return xml;
};

export const invalidateSitemapCache = () => {
  cachedSitemap = null;
  cacheExpiresAt = 0;
};
