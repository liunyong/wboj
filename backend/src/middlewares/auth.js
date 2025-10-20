import User from '../models/User.js';
import { decodeAccessToken, touchSession } from '../services/authService.js';

const extractBearerToken = (req) => {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header || typeof header !== 'string') {
    return '';
  }
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') {
    return '';
  }
  return token?.trim() ?? '';
};

const resolveUserFromToken = async (token) => {
  const payload = decodeAccessToken(token);
  if (!payload?.sub || !payload?.sid) {
    return null;
  }
  const user = await User.findById(payload.sub).select(
    'username email role isActive deletedAt profile profilePublic createdAt updatedAt'
  );
  if (!user || !user.isActive || user.deletedAt) {
    return null;
  }
  const touchResult = await touchSession(payload.sub, payload.sid);
  if (!touchResult) {
    return null;
  }
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    deletedAt: user.deletedAt,
    profile: user.profile,
    profilePublic: user.profilePublic ?? false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    session: {
      sid: payload.sid,
      inactivityExpiresAt: touchResult.inactivityExpiresAt
    }
  };
};

export const authenticateOptional = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return next();
    }
    const resolved = await resolveUserFromToken(token);
    if (resolved) {
      const { session, ...user } = resolved;
      req.user = user;
      req.session = session;
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireAuth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Authentication required' });
    }

    const resolved = await resolveUserFromToken(token);
    if (!resolved) {
      return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Invalid or expired token' });
    }

    const { session, ...user } = resolved;
    req.user = user;
    req.session = session;
    return next();
  } catch (error) {
    return next(error);
  }
};

const roleHierarchy = {
  user: 0,
  admin: 1,
  super_admin: 2
};

const hasRole = (userRole, requiredRole) => {
  const userRank = roleHierarchy[userRole] ?? -1;
  const requiredRank = roleHierarchy[requiredRole] ?? Number.POSITIVE_INFINITY;
  if (requiredRole === 'admin') {
    return userRank >= roleHierarchy.admin;
  }
  return userRank >= requiredRank;
};

export const requireRole = (role) => async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Authentication required' });
    }

    if (!req.user.isActive || req.user.deletedAt) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Account inactive' });
    }

    if (!hasRole(req.user.role, role)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
