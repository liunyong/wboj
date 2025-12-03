import { getSitemapXml } from '../services/sitemapService.js';

const FIFTEEN_MINUTES = 15 * 60;

export const serveSitemap = async (req, res, next) => {
  try {
    const xml = await getSitemapXml();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', `public, max-age=${FIFTEEN_MINUTES}`);
    res.setHeader('X-Robots-Tag', 'noindex, follow');
    res.send(xml);
  } catch (error) {
    next(error);
  }
};
