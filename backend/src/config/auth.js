import { env } from './env.js';

export const ACCESS_TOKEN_SECRET = env.accessTokenSecret;
export const REFRESH_TOKEN_SECRET = env.refreshTokenSecret;
export const ACCESS_TOKEN_TTL = env.accessTokenTtl;
export const REFRESH_TOKEN_TTL = env.refreshTokenTtl;

export const MAX_SESSIONS_PER_USER = env.maxSessionsPerUser;

export const INACTIVITY_TTL_MS = env.inactivityTtlMs;
export const WARNING_LEAD_MS = env.warningLeadMs;
export const MIN_TOUCH_INTERVAL_MS = env.minTouchIntervalMs;
