import User from '../models/User.js';
import { decodeAccessToken } from '../services/authService.js';

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
  if (!payload?.sub) {
    return null;
  }
  const user = await User.findById(payload.sub).select(
    'username email role isActive profile createdAt updatedAt'
  );
  if (!user || !user.isActive) {
    return null;
  }
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    profile: user.profile,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

export const authenticateOptional = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return next();
    }
    const user = await resolveUserFromToken(token);
    if (user) {
      req.user = user;
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

    const user = await resolveUserFromToken(token);
    if (!user) {
      return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Invalid or expired token' });
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireRole = (role) => async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Authentication required' });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
