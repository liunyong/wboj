import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  MAX_SESSIONS_PER_USER
} from '../config/auth.js';
import User from '../models/User.js';

const DURATION_MULTIPLIERS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
};

const parseDurationMs = (value, fallbackMs) => {
  if (!value) {
    return fallbackMs;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const trimmed = String(value).trim();
  const match = trimmed.match(/^(\d+)([smhd])?$/i);
  if (!match) {
    const numeric = Number.parseInt(trimmed, 10);
    if (Number.isFinite(numeric)) {
      return numeric * 1000;
    }
    return fallbackMs;
  }

  const amount = Number.parseInt(match[1], 10);
  const unitKey = match[2]?.toLowerCase();
  const multiplier = unitKey ? DURATION_MULTIPLIERS[unitKey] : 1000;

  return amount * multiplier;
};

const refreshTtlMs = parseDurationMs(REFRESH_TOKEN_TTL, 7 * 24 * 60 * 60 * 1000);
const refreshTtlSeconds = Math.round(refreshTtlMs / 1000);

export const hashPassword = async (password) => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

export const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      username: user.username
    },
    ACCESS_TOKEN_SECRET,
    {
      expiresIn: ACCESS_TOKEN_TTL
    }
  );

const createSessionId = () => crypto.randomBytes(48).toString('hex');

const hashSessionId = (value) => crypto.createHash('sha256').update(value).digest('hex');

const pruneExpiredSessions = (sessions = []) => {
  const now = Date.now();
  return sessions.filter((session) => session.expiresAt && session.expiresAt.getTime() > now);
};

const persistSessionsIfChanged = async (user, nextSessions) => {
  const changed =
    (user.sessions || []).length !== nextSessions.length ||
    (user.sessions || []).some((session, index) => session.tokenHash !== nextSessions[index]?.tokenHash);

  if (changed) {
    user.sessions = nextSessions;
    await user.save();
  }
};

export const issueRefreshToken = async (user) => {
  const sessionId = createSessionId();
  const tokenHash = hashSessionId(sessionId);
  const expiresAt = new Date(Date.now() + refreshTtlMs);

  const sessions = pruneExpiredSessions(user.sessions ?? []);
  sessions.push({ tokenHash, expiresAt, createdAt: new Date() });

  while (sessions.length > MAX_SESSIONS_PER_USER) {
    sessions.shift();
  }

  user.sessions = sessions;
  await user.save();

  const refreshToken = jwt.sign(
    {
      sub: user._id.toString(),
      sid: tokenHash
    },
    REFRESH_TOKEN_SECRET,
    {
      expiresIn: refreshTtlSeconds
    }
  );

  return refreshToken;
};

export const createAuthTokens = async (user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user);
  return { accessToken, refreshToken };
};

export const decodeAccessToken = (token) => {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
  } catch (error) {
    return null;
  }
};

export const decodeRefreshToken = (token) => {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET);
  } catch (error) {
    return null;
  }
};

export const findUserByRefreshToken = async (token) => {
  const payload = decodeRefreshToken(token);
  if (!payload?.sub || !payload?.sid) {
    return null;
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    return null;
  }

  const sessions = pruneExpiredSessions(user.sessions ?? []);
  const matchIndex = sessions.findIndex((session) => session.tokenHash === payload.sid);
  if (matchIndex === -1) {
    await persistSessionsIfChanged(user, sessions);
    return null;
  }

  sessions.splice(matchIndex, 1);
  await persistSessionsIfChanged(user, sessions);
  return user;
};

export const revokeRefreshToken = async (token) => {
  const payload = decodeRefreshToken(token);
  if (!payload?.sub || !payload?.sid) {
    return;
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    return;
  }

  const sessions = pruneExpiredSessions(user.sessions ?? []).filter(
    (session) => session.tokenHash !== payload.sid
  );

  await persistSessionsIfChanged(user, sessions);
};

export const revokeAllSessions = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    return;
  }
  user.sessions = [];
  await user.save();
};
*** End of File
