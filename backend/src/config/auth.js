const getEnv = (key, fallback) => {
  if (process.env[key] && process.env[key].trim() !== '') {
    return process.env[key];
  }
  return fallback;
};

export const ACCESS_TOKEN_SECRET = getEnv('ACCESS_TOKEN_SECRET', 'dev-access-secret');
export const REFRESH_TOKEN_SECRET = getEnv('REFRESH_TOKEN_SECRET', 'dev-refresh-secret');
export const ACCESS_TOKEN_TTL = getEnv('ACCESS_TOKEN_TTL', '15m');
export const REFRESH_TOKEN_TTL = getEnv('REFRESH_TOKEN_TTL', '7d');

export const MAX_SESSIONS_PER_USER = Number.parseInt(getEnv('MAX_SESSIONS_PER_USER', '5'), 10);
