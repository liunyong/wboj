import rateLimit from 'express-rate-limit';
import { getSharedRateLimitStore } from '../utils/rateLimitStoreFactory.js';

const sharedOptions = (prefix) => ({ store: getSharedRateLimitStore(prefix) ?? undefined });

const defaultKeyGenerator = (req) =>
  req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

export const listRateLimiter = rateLimit({
  ...sharedOptions('rl:list:'),
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: defaultKeyGenerator
});

export const adminListRateLimiter = rateLimit({
  ...sharedOptions('rl:admin-list:'),
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: defaultKeyGenerator
});

export const submitRateLimiter = rateLimit({
  ...sharedOptions('rl:submit:'),
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: defaultKeyGenerator
});

export const resubmitRateLimiter = rateLimit({
  ...sharedOptions('rl:resubmit:'),
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: defaultKeyGenerator
});

export const uploadImageRateLimiter = rateLimit({
  ...sharedOptions('rl:upload:'),
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: defaultKeyGenerator
});
