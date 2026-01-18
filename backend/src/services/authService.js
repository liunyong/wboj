import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  MAX_SESSIONS_PER_USER,
  INACTIVITY_TTL_MS,
  MIN_TOUCH_INTERVAL_MS
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
      return numeric;
    }
    return fallbackMs;
  }

  const amount = Number.parseInt(match[1], 10);
  const unitKey = match[2]?.toLowerCase();
  const multiplier = unitKey ? DURATION_MULTIPLIERS[unitKey] : 1;

  return amount * multiplier;
};

const timeValue = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  const parsed = new Date(value);
  const time = parsed.getTime();
  return Number.isNaN(time) ? null : time;
};

const isSessionExpired = (session, now) => {
  if (!session) {
    return true;
  }
  const expiresAtMs = timeValue(session.expiresAt);
  const inactivityExpiresAtMs = timeValue(session.inactivityExpiresAt);
  if (expiresAtMs !== null && expiresAtMs <= now) {
    return true;
  }
  if (inactivityExpiresAtMs !== null && inactivityExpiresAtMs <= now) {
    return true;
  }
  return false;
};

const refreshTtlMs = parseDurationMs(REFRESH_TOKEN_TTL, 7 * 24 * 60 * 60 * 1000);
const refreshTtlSeconds = Math.round(refreshTtlMs / 1000);

const inactivityTtlMs = parseDurationMs(INACTIVITY_TTL_MS, 2 * 60 * 60 * 1000);
const minTouchIntervalMs = parseDurationMs(MIN_TOUCH_INTERVAL_MS, 60 * 1000);

export const SESSION_INACTIVITY_TTL_MS = inactivityTtlMs;
export const SESSION_MIN_TOUCH_INTERVAL_MS = minTouchIntervalMs;

export const hashPassword = async (password) => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

export const signAccessToken = (user, sid) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      username: user.username,
      sid
    },
    ACCESS_TOKEN_SECRET,
    {
      expiresIn: ACCESS_TOKEN_TTL
    }
  );

const createSessionId = () => crypto.randomBytes(48).toString('hex');

const hashSessionId = (value) => crypto.createHash('sha256').update(value).digest('hex');

const pruneExpiredSessions = (sessions = [], now = Date.now()) => {
  const nextSessions = [];

  for (const session of sessions) {
    if (!session?.tokenHash) {
      continue;
    }

    const expiresAtMs = timeValue(session.expiresAt);
    if (expiresAtMs === null) {
      continue;
    }

    const createdAtMs = timeValue(session.createdAt) ?? now;
    const inactivityExpiresAtMs =
      timeValue(session.inactivityExpiresAt) ?? now + inactivityTtlMs;
    const lastTouchedAtMs =
      timeValue(session.lastTouchedAt) ?? now - minTouchIntervalMs - 1;

    if (expiresAtMs <= now || inactivityExpiresAtMs <= now) {
      continue;
    }

    nextSessions.push({
      tokenHash: session.tokenHash,
      expiresAt: new Date(expiresAtMs),
      inactivityExpiresAt: new Date(inactivityExpiresAtMs),
      lastTouchedAt: new Date(lastTouchedAtMs),
      createdAt: new Date(createdAtMs),
      userAgent: session.userAgent ?? null,
      ip: session.ip ?? null
    });
  }

  return nextSessions;
};

const sessionsEqual = (current = [], next = []) => {
  if (current.length !== next.length) {
    return false;
  }

  for (let index = 0; index < current.length; index += 1) {
    const left = current[index];
    const right = next[index];
    if (!right) {
      return false;
    }

    if (left.tokenHash !== right.tokenHash) {
      return false;
    }

    if (timeValue(left.expiresAt) !== timeValue(right.expiresAt)) {
      return false;
    }

    if (timeValue(left.inactivityExpiresAt) !== timeValue(right.inactivityExpiresAt)) {
      return false;
    }

    if (timeValue(left.lastTouchedAt) !== timeValue(right.lastTouchedAt)) {
      return false;
    }

    if (timeValue(left.createdAt) !== timeValue(right.createdAt)) {
      return false;
    }
    if ((left.userAgent ?? null) !== (right.userAgent ?? null)) {
      return false;
    }
    if ((left.ip ?? null) !== (right.ip ?? null)) {
      return false;
    }
  }

  return true;
};

const persistSessionsIfChanged = async (user, nextSessions) => {
  if (!sessionsEqual(user.sessions ?? [], nextSessions)) {
    user.sessions = nextSessions;
    await user.save();
  }
};

export const issueRefreshToken = async (user, { userAgent = null, ip = null } = {}) => {
  const now = Date.now();
  const sessions = pruneExpiredSessions(user.sessions ?? [], now);

  const sessionId = createSessionId();
  const tokenHash = hashSessionId(sessionId);

  sessions.push({
    tokenHash,
    expiresAt: new Date(now + refreshTtlMs),
    inactivityExpiresAt: new Date(now + inactivityTtlMs),
    lastTouchedAt: new Date(now),
    createdAt: new Date(now),
    userAgent,
    ip
  });

  while (sessions.length > MAX_SESSIONS_PER_USER) {
    sessions.shift();
  }

  await persistSessionsIfChanged(user, sessions);

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

  return { refreshToken, sid: tokenHash };
};

export const createAuthTokens = async (user, meta = {}) => {
  const { refreshToken, sid } = await issueRefreshToken(user, meta);
  const accessToken = signAccessToken(user, sid);
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

export const consumeRefreshToken = async (token) => {
  const payload = decodeRefreshToken(token);
  if (!payload?.sub || !payload?.sid) {
    return { user: null, invalid: true };
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    return { user: null, invalid: true };
  }

  const now = Date.now();
  const rawSessions = Array.isArray(user.sessions) ? user.sessions : [];
  const storedMatch = rawSessions.find((session) => session.tokenHash === payload.sid);
  const sessions = pruneExpiredSessions(rawSessions, now);
  const matchIndex = sessions.findIndex((session) => session.tokenHash === payload.sid);

  if (!storedMatch) {
    await persistSessionsIfChanged(user, sessions);
    return { user, reused: true };
  }

  if (isSessionExpired(storedMatch, now)) {
    await persistSessionsIfChanged(user, sessions);
    return { user, expired: true };
  }

  if (matchIndex === -1) {
    await persistSessionsIfChanged(user, sessions);
    return { user, reused: true };
  }

  const session = sessions[matchIndex];
  sessions.splice(matchIndex, 1);
  await persistSessionsIfChanged(user, sessions);
  return { user, session, reused: false };
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

export const revokeSessionById = async (userId, sessionId) => {
  if (!sessionId) {
    return false;
  }
  const user = await User.findById(userId);
  if (!user) {
    return false;
  }
  const sessions = pruneExpiredSessions(user.sessions ?? []);
  const nextSessions = sessions.filter((session) => session.tokenHash !== sessionId);
  await persistSessionsIfChanged(user, nextSessions);
  return nextSessions.length !== sessions.length;
};

export const revokeOtherSessions = async (userId, currentSessionId) => {
  const user = await User.findById(userId);
  if (!user) {
    return 0;
  }
  const sessions = pruneExpiredSessions(user.sessions ?? []);
  const nextSessions = sessions.filter((session) => session.tokenHash === currentSessionId);
  await persistSessionsIfChanged(user, nextSessions);
  return sessions.length - nextSessions.length;
};

export const listUserSessions = async (userId) => {
  const user = await User.findById(userId).select('sessions');
  if (!user) {
    return [];
  }
  const sessions = pruneExpiredSessions(user.sessions ?? []);
  await persistSessionsIfChanged(user, sessions);
  return sessions;
};

export const touchSession = async (userId, sid, { force = false } = {}) => {
  if (!sid) {
    return null;
  }

  const user = await User.findById(userId).select('sessions');
  if (!user) {
    return null;
  }

  const now = Date.now();
  const sessions = pruneExpiredSessions(user.sessions ?? [], now);
  const targetIndex = sessions.findIndex((session) => session.tokenHash === sid);

  if (targetIndex === -1) {
    await persistSessionsIfChanged(user, sessions);
    return null;
  }

  const session = sessions[targetIndex];

  if (!force && now - session.lastTouchedAt.getTime() < minTouchIntervalMs) {
    await persistSessionsIfChanged(user, sessions);
    return {
      inactivityExpiresAt: session.inactivityExpiresAt.getTime(),
      touched: false
    };
  }

  const updatedSession = {
    ...session,
    inactivityExpiresAt: new Date(now + inactivityTtlMs),
    lastTouchedAt: new Date(now)
  };

  sessions[targetIndex] = updatedSession;

  await persistSessionsIfChanged(user, sessions);

  return {
    inactivityExpiresAt: updatedSession.inactivityExpiresAt.getTime(),
    touched: true
  };
};

export const getSessionMeta = async (userId, sid) => {
  if (!sid) {
    return null;
  }

  const user = await User.findById(userId).select('sessions');
  if (!user) {
    return null;
  }

  const sessions = pruneExpiredSessions(user.sessions ?? []);
  const session = sessions.find((entry) => entry.tokenHash === sid);

  await persistSessionsIfChanged(user, sessions);

  if (!session) {
    return null;
  }

  return { inactivityExpiresAt: session.inactivityExpiresAt.getTime() };
};
