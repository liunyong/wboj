const parseList = (value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const prerenderAgents = parseList(process.env.SEO_PRERENDER_AGENTS || 'rendertron,prerender.io,react-snap,headless-chrome').map(
  (entry) => new RegExp(entry, 'i')
);

const allowIndexing = process.env.SEO_ALLOW_INDEXING === 'true';
const cacheSeconds = Number.parseInt(process.env.API_CACHE_SECONDS ?? '0', 10);

const isSeoFriendlyBot = (userAgent = '') => prerenderAgents.some((pattern) => pattern.test(userAgent));

const shouldSkipCacheControl = (req) => req.originalUrl.startsWith('/uploads');

const buildCacheHeader = (method) => {
  if (!['GET', 'HEAD'].includes(method)) {
    return 'no-store, no-cache, must-revalidate';
  }
  if (cacheSeconds > 0) {
    return `public, max-age=${cacheSeconds}, stale-while-revalidate=60`;
  }
  return 'no-store, no-cache, must-revalidate';
};

const seoHeaders = (req, res, next) => {
  const userAgent = req.get('user-agent') || '';
  const isApiRoute = req.originalUrl.startsWith('/api');
  const shouldAllowIndex = (!isApiRoute && allowIndexing) || isSeoFriendlyBot(userAgent);
  const robotsValue = shouldAllowIndex ? 'index, follow' : 'noindex, nofollow';
  res.setHeader('X-Robots-Tag', robotsValue);

  if (!shouldSkipCacheControl(req) && !res.getHeader('Cache-Control')) {
    res.setHeader('Cache-Control', buildCacheHeader(req.method));
  }

  next();
};

export default seoHeaders;
