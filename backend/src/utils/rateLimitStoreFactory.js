import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let storeInstance = null;
let clientInstance = null;
let attemptedInit = false;

const debugAuth = () => process.env.DEBUG_AUTH === '1';

const logDebug = (message, meta = {}) => {
  if (!debugAuth()) {
    return;
  }
  const payload = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  console.log(`[auth] ${message}${payload}`);
};

export const getSharedRateLimitStore = () => {
  if (process.env.RATE_LIMIT_USE_REDIS !== 'true') {
    return null;
  }

  if (storeInstance || attemptedInit) {
    return storeInstance;
  }

  attemptedInit = true;
  const url = process.env.REDIS_URL;
  if (!url) {
    logDebug('RATE_LIMIT_USE_REDIS set without REDIS_URL');
    return null;
  }

  try {
    const { RedisStore } = require('rate-limit-redis');
    const { createClient } = require('redis');

    clientInstance = createClient({ url });
    clientInstance.on('error', (error) => {
      logDebug('Redis rate limit client error', { message: error.message });
    });
    clientInstance
      .connect()
      .then(() => {
        logDebug('Redis rate limit client connected');
      })
      .catch((error) => {
        logDebug('Failed to connect Redis rate limit client', { message: error.message });
      });

    storeInstance = new RedisStore({
      sendCommand: (...args) => clientInstance.sendCommand(args)
    });
    logDebug('Redis rate limit store initialised');
  } catch (error) {
    logDebug('Unable to load Redis rate limit store', { message: error.message });
    storeInstance = null;
  }

  return storeInstance;
};

export const getRateLimitKeyFromIp = (req) =>
  req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

