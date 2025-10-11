import User from '../models/User.js';
import {
  createAuthTokens,
  findUserByRefreshToken,
  hashPassword,
  revokeRefreshToken,
  verifyPassword
} from '../services/authService.js';
import { getPasswordStrengthIssues } from '../validation/passwordRules.js';

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  username: user.username,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  profile: user.profile ?? {},
  profilePublic: user.profilePublic ?? false,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

export const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.validated?.body || req.body;
    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      $or: [{ username: normalizedUsername }, { email: normalizedEmail }]
    });

    if (existingUser) {
      return res.status(409).json({
        code: 'USER_EXISTS',
        message: 'Username or email already taken'
      });
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      role: 'user',
      passwordChangedAt: new Date()
    });

    const tokens = await createAuthTokens(user);

    res.status(201).json({
      user: sanitizeUser(user),
      tokens
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { usernameOrEmail, password } = req.validated?.body || req.body;
    const trimmedIdentifier = usernameOrEmail.trim();
    const normalizedEmail = trimmedIdentifier.toLowerCase();

    const user = await User.findOne({
      $or: [{ username: trimmedIdentifier }, { email: normalizedEmail }]
    });

    if (!user) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ code: 'ACCOUNT_INACTIVE', message: 'Account is inactive' });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    const tokens = await createAuthTokens(user);

    res.json({
      user: sanitizeUser(user),
      tokens
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.validated?.body || req.body;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res) => {
  res.json({ user: req.user });
};

export const updateProfile = async (req, res, next) => {
  try {
    const updates = req.validated?.body || req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const nextProfile = { ...(user.profile ?? {}) };
    if (Object.prototype.hasOwnProperty.call(updates, 'displayName')) {
      nextProfile.displayName = updates.displayName;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'bio')) {
      nextProfile.bio = updates.bio;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'avatarUrl')) {
      nextProfile.avatarUrl = updates.avatarUrl;
    }

    user.profile = nextProfile;

    await user.save();

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};

export const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.validated?.body || req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' });
    }

    const issues = getPasswordStrengthIssues(newPassword, {
      username: user.username,
      email: user.email
    });

    if (issues.length) {
      return res.status(400).json({
        code: 'WEAK_PASSWORD',
        message: issues[0],
        details: issues
      });
    }

    user.passwordHash = await hashPassword(newPassword);
    user.sessions = [];
    user.passwordChangedAt = new Date();
    await user.save();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.validated?.body || req.body;
    if (!refreshToken) {
      return res
        .status(400)
        .json({ code: 'INVALID_REQUEST', message: 'Refresh token is required' });
    }

    const user = await findUserByRefreshToken(refreshToken);
    if (!user) {
      return res.status(401).json({ code: 'INVALID_TOKEN', message: 'Refresh token is invalid' });
    }

    const tokens = await createAuthTokens(user);

    res.json({
      user: sanitizeUser(user),
      tokens
    });
  } catch (error) {
    next(error);
  }
};
