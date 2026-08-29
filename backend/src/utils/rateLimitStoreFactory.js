import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let clientInstance = null;
let attemptedInit = false;
let RedisStoreClass = null;

const debugAuth = () => process.env.DEBUG_AUTH === '1';

const logDebug = (message, meta = {}) => {
  if (!debugAuth()) {
    return;
  }
  const payload = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  console.log(`[auth] ${message}${payload}`);
};

export const getSharedRateLimitStore = (prefix = 'rl:') => {
  if (process.env.RATE_LIMIT_USE_REDIS !== 'true') {
    return null;
  }

  if (attemptedInit && (!clientInstance || !RedisStoreClass)) return null;
  const url = process.env.REDIS_URL;
  if (!url) {
    logDebug('RATE_LIMIT_USE_REDIS set without REDIS_URL');
    return null;
  }

  try {
    if (!clientInstance) {
      attemptedInit = true;
      const { RedisStore } = require('rate-limit-redis');
      const { createClient } = require('redis');
      RedisStoreClass = RedisStore;

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
    }
    const store = new RedisStoreClass({
      sendCommand: (...args) => clientInstance.sendCommand(args),
      prefix
    });
    logDebug('Redis rate limit store initialised', { prefix });
    return store;
  } catch (error) {
    logDebug('Unable to load Redis rate limit store', { message: error.message });
    clientInstance = null;
    RedisStoreClass = null;
  }
  return null;
};

export const getRateLimitKeyFromIp = (req) =>
  req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
