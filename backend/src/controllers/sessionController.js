import { getSessionMeta, touchSession } from '../services/authService.js';

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
