import {
  getSessionMeta,
  listUserSessions,
  revokeAllSessions,
  revokeOtherSessions,
  revokeSessionById,
  touchSession
} from '../services/authService.js';
import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  WARNING_LEAD_MS
} from '../config/auth.js';
import {
  SESSION_INACTIVITY_TTL_MS,
  SESSION_MIN_TOUCH_INTERVAL_MS
} from '../services/authService.js';

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
    return Number.isFinite(numeric) ? numeric : fallbackMs;
  }
  const amount = Number.parseInt(match[1], 10);
  const unit = match[2]?.toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };
  const multiplier = unit ? multipliers[unit] ?? 1 : 1;
  return amount * multiplier;
};

const buildExpiredResponse = (res) =>
  res
    .status(401)
    .json({ code: 'SESSION_EXPIRED', message: 'Session has expired, please sign in again' });

export const getSessionState = async (req, res, next) => {
  try {
    const sid = req.session?.sid;
    if (!sid) {
      return buildExpiredResponse(res);
    }

    const meta = await getSessionMeta(req.user.id, sid);
    if (!meta) {
      return buildExpiredResponse(res);
    }

    return res.json({
      serverNow: Date.now(),
      inactivityExpiresAt: meta.inactivityExpiresAt
    });
  } catch (error) {
    return next(error);
  }
};

export const getSessionPolicy = async (_req, res) => {
  res.json({
    accessTokenTtl: ACCESS_TOKEN_TTL,
    refreshTokenTtl: REFRESH_TOKEN_TTL,
    inactivityTtlMs: SESSION_INACTIVITY_TTL_MS,
    warningLeadMs: parseDurationMs(WARNING_LEAD_MS, 15 * 60 * 1000),
    minTouchIntervalMs: SESSION_MIN_TOUCH_INTERVAL_MS
  });
};

export const listSessions = async (req, res, next) => {
  try {
    const sessions = await listUserSessions(req.user.id);
    const currentSid = req.session?.sid ?? null;
    res.json({
      sessions: sessions.map((session) => ({
        id: session.tokenHash,
        createdAt: session.createdAt,
        lastTouchedAt: session.lastTouchedAt,
        inactivityExpiresAt: session.inactivityExpiresAt,
        expiresAt: session.expiresAt,
        userAgent: session.userAgent ?? null,
        ip: session.ip ?? null,
        isCurrent: currentSid ? session.tokenHash === currentSid : false
      }))
    });
  } catch (error) {
    next(error);
  }
};

export const revokeSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const revoked = await revokeSessionById(req.user.id, id);
    res.json({ revoked });
  } catch (error) {
    next(error);
  }
};

export const revokeSessions = async (req, res, next) => {
  try {
    const scope = req.body?.scope ?? 'all';
    if (scope === 'others') {
      const count = await revokeOtherSessions(req.user.id, req.session?.sid ?? null);
      return res.json({ revoked: count });
    }
    await revokeAllSessions(req.user.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

export const extendSession = async (req, res, next) => {
  try {
    const sid = req.session?.sid;
    if (!sid) {
      return buildExpiredResponse(res);
    }

    const result = await touchSession(req.user.id, sid, { force: true });
    if (!result) {
      return buildExpiredResponse(res);
    }

    return res.json({
      inactivityExpiresAt: result.inactivityExpiresAt
    });
  } catch (error) {
    return next(error);
  }
};
