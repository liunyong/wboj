import 'dotenv/config';
import crypto from 'node:crypto';

const read = (key, fallback = '') => process.env[key]?.trim() || fallback;
const integer = (key, fallback) => {
  const value = Number.parseInt(read(key, String(fallback)), 10);
  if (!Number.isFinite(value)) {
    throw new Error(`${key} must be an integer`);
  }
  return value;
};

const isProduction = read('NODE_ENV') === 'production';
const developmentSecret = (name) => `${name}-${crypto.randomBytes(32).toString('hex')}`;

const requireProductionSecret = (key, fallbackName) => {
  const value = read(key);
  if (isProduction && (!value || value.startsWith('replace-me') || value.startsWith('dev-'))) {
    throw new Error(`${key} must be set to a strong, unique value in production`);
  }
  return value || developmentSecret(fallbackName);
};

export const env = Object.freeze({
  nodeEnv: read('NODE_ENV', 'development'),
  isProduction,
  port: integer('PORT', 4000),
  mongoUri: read('MONGO_URI', 'mongodb://localhost:27017/judge0'),
  judge0Url: read('JUDGE0_URL', 'http://localhost:2358'),
  frontendOrigins: read('FRONTEND_ORIGINS', read('FRONTEND_ORIGIN', 'http://localhost:5173'))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: read('TRUST_PROXY', isProduction ? '1' : 'false'),
  accessTokenSecret: requireProductionSecret('ACCESS_TOKEN_SECRET', 'access'),
  refreshTokenSecret: requireProductionSecret('REFRESH_TOKEN_SECRET', 'refresh'),
  accessTokenTtl: read('ACCESS_TOKEN_TTL', '15m'),
  refreshTokenTtl: read('REFRESH_TOKEN_TTL', '7d'),
  maxSessionsPerUser: integer('MAX_SESSIONS_PER_USER', 5),
  inactivityTtlMs: read('INACTIVITY_TTL_MS', String(30 * 60 * 1000)),
  warningLeadMs: read('WARNING_LEAD_MS', String(5 * 60 * 1000)),
  minTouchIntervalMs: read('MIN_TOUCH_INTERVAL_MS', String(60 * 1000)),
  refreshCookieName: read('REFRESH_COOKIE_NAME', 'oj_refresh'),
  exposeRefreshToken: read('AUTH_EXPOSE_REFRESH_TOKEN', isProduction ? 'false' : 'true') === 'true',
  turnstileSecretKey: read('TURNSTILE_SECRET_KEY'),
  turnstileExpectedHostname: read('TURNSTILE_EXPECTED_HOSTNAME'),
  loginCaptchaThreshold: integer('LOGIN_CAPTCHA_THRESHOLD', 3),
  workerPollMs: integer('SUBMISSION_WORKER_POLL_MS', 1000),
  staleSubmissionMs: integer('SUBMISSION_STALE_MS', 5 * 60 * 1000),
  maxRunHistory: integer('SUBMISSION_MAX_RUN_HISTORY', 20)
});

export const parseTrustProxy = () => {
  if (env.trustProxy === 'false') return false;
  if (env.trustProxy === 'true') return true;
  const numeric = Number.parseInt(env.trustProxy, 10);
  return Number.isFinite(numeric) ? numeric : env.trustProxy;
};
