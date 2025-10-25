import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const getEnv = (key, fallback) => {
  const value = process.env[key];
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  return null;
};

const resolveSecret = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const resolved = path.resolve(trimmed);
    const stats = fs.statSync(resolved);
    if (stats.isFile()) {
      return fs.readFileSync(resolved, 'utf8').trim();
    }
  } catch (error) {
    // If the path does not exist or is not readable, fall back to using the raw value.
  }

  return trimmed;
};

const parseNumber = (rawValue, fallback) => {
  if (rawValue === null || rawValue === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const APP_BASE_URL = getEnv('APP_BASE_URL', 'http://localhost:5173');
export const SMTP_HOST = getEnv('SMTP_HOST', null);
export const SMTP_PORT = parseNumber(getEnv('SMTP_PORT', '587'), 587);
export const SMTP_USER = getEnv('SMTP_USER', null);
export const SMTP_PASS = resolveSecret(getEnv('SMTP_PASS', null));
export const SMTP_FROM = getEnv('SMTP_FROM', SMTP_USER);
export const EMAIL_VERIFICATION_EXPIRES_MIN = parseNumber(
  getEnv('EMAIL_VERIFICATION_EXPIRES_MIN', '60'),
  60
);
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = parseNumber(
  getEnv('EMAIL_VERIFICATION_RESEND_COOLDOWN_MS', '60000'),
  60000
);
export const PASSWORD_RESET_EXPIRES_MIN = parseNumber(
  getEnv('PASSWORD_RESET_EXPIRES_MIN', '30'),
  30
);
export const PASSWORD_RESET_RESEND_COOLDOWN_MS = parseNumber(
  getEnv('PASSWORD_RESET_RESEND_COOLDOWN_MS', '300000'),
  300000
);
