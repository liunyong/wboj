import crypto from 'node:crypto';
import User from '../models/User.js';
import {
  createAuthTokens,
  findUserByRefreshToken,
  hashPassword,
  revokeRefreshToken,
  verifyPassword
} from '../services/authService.js';
import {
  ensureUserCanResendVerification,
  issueEmailVerification,
  verifyEmailToken
} from '../services/emailVerificationService.js';
import {
  clearPasswordResetState,
  ensureUserCanRequestPasswordReset,
  issuePasswordReset,
  verifyPasswordResetToken
} from '../services/passwordResetService.js';
import { getPasswordStrengthIssues } from '../validation/passwordRules.js';

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  username: user.username,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  profile: user.profile ?? {},
  profilePublic: user.profilePublic ?? false,
  emailVerified: user.emailVerified ?? false,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

const debugAuth = () => process.env.DEBUG_AUTH === '1';
const logAuth = (level, message, meta) => {
  if (!debugAuth()) {
    return;
  }
  const payload = meta ? ` ${JSON.stringify(meta)}` : '';
  const method = level === 'warn' ? console.warn : console.log;
  method(`[auth] ${message}${payload}`);
};

const anonymizeIdentifier = (value) => {
  if (!value) {
    return 'unknown';
  }
  const hash = crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
  return `hash:${hash}`;
};

export const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.validated?.body || req.body;
    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      $or: [{ username: normalizedUsername }, { email: normalizedEmail }]
    });

    if (existingUser) {
      const field =
        existingUser.email === normalizedEmail
          ? 'email'
          : existingUser.username === normalizedUsername
          ? 'username'
          : 'username';
      const meta = {
        field,
        usernameHash: anonymizeIdentifier(normalizedUsername)
      };
      if (field === 'email') {
        meta.emailHash = anonymizeIdentifier(normalizedEmail);
      }
      logAuth('warn', 'registration duplicate detected', meta);
      return res.status(409).json({
        code: 'DUPLICATE',
        field,
        message: field === 'email' ? 'Email already registered' : 'Username already taken'
      });
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      role: 'user',
      passwordChangedAt: new Date(),
      emailVerified: false
    });

    await issueEmailVerification(user);

    logAuth('info', 'user registered', {
      userId: user._id.toString(),
      usernameHash: anonymizeIdentifier(user.username),
      emailHash: anonymizeIdentifier(user.email)
    });

    res.status(201).json({
      user: sanitizeUser(user),
      code: 'VERIFICATION_REQUIRED',
      message: 'Verification email sent'
    });
  } catch (error) {
    if (error?.code === 11000) {
      const field =
        error.keyPattern?.email ? 'email' : error.keyPattern?.username ? 'username' : 'unknown';
      logAuth('warn', 'registration duplicate error', {
        field,
        usernameHash: req.validated?.body?.username
          ? anonymizeIdentifier(req.validated.body.username)
          : undefined,
        emailHash: req.validated?.body?.email
          ? anonymizeIdentifier(req.validated.body.email)
          : undefined
      });
      return res.status(409).json({
        code: 'DUPLICATE',
        field,
        message: field === 'email' ? 'Email already registered' : 'Username already taken'
      });
    }
    next(error);
  }
};

export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.validated?.body || req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    if (user.emailVerified) {
      return res
        .status(200)
        .json({ code: 'ALREADY_VERIFIED', message: 'Email is already verified' });
    }

    if (!ensureUserCanResendVerification(user)) {
      return res.status(429).json({
        code: 'EMAIL_RESEND_RATE_LIMITED',
        message: 'Please wait before requesting another verification email'
      });
    }

    await issueEmailVerification(user);

    logAuth('info', 'verification email resent', { userId: user._id.toString() });

    return res.status(200).json({
      code: 'VERIFICATION_EMAIL_SENT',
      message: 'Verification email sent'
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { email, token } = req.validated?.body || req.body;
    const result = await verifyEmailToken({ email, token });

    if (result.status === 'not_found') {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    if (result.status === 'verified') {
      logAuth('info', 'email verified', { userId: result.user._id.toString() });
      return res.json({
        code: 'EMAIL_VERIFIED',
        message: 'Email verified successfully',
        user: sanitizeUser(result.user)
      });
    }

    if (result.status === 'already_verified') {
      return res.json({
        code: 'ALREADY_VERIFIED',
        message: 'Email already verified',
        user: sanitizeUser(result.user)
      });
    }

    if (result.status === 'expired') {
      return res.status(410).json({
        code: 'TOKEN_EXPIRED',
        message: 'Verification link has expired'
      });
    }

    return res.status(400).json({
      code: 'TOKEN_INVALID',
      message: 'Verification token is invalid'
    });
  } catch (error) {
    next(error);
  }
};

export const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.validated?.body || req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(200).json({
        code: 'PASSWORD_RESET_EMAIL_SENT',
        message: 'If the email is registered, a reset link has been sent'
      });
    }

    if (!ensureUserCanRequestPasswordReset(user)) {
      return res.status(200).json({
        code: 'PASSWORD_RESET_EMAIL_SENT',
        message: 'Password reset email was recently sent'
      });
    }

    await issuePasswordReset(user);

    logAuth('info', 'password reset email issued', { userId: user._id.toString() });

    return res.status(200).json({
      code: 'PASSWORD_RESET_EMAIL_SENT',
      message: 'Password reset email sent'
    });
  } catch (error) {
    next(error);
  }
};

export const resetPasswordWithToken = async (req, res, next) => {
  try {
    const { email, token, password } = req.validated?.body || req.body;

    const result = await verifyPasswordResetToken({ email, token });

    if (result.status === 'not_found') {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const user = result.user;

    if (result.status === 'expired') {
      return res.status(410).json({
        code: 'TOKEN_EXPIRED',
        message: 'Password reset link has expired'
      });
    }

    if (result.status !== 'valid') {
      return res.status(400).json({
        code: 'TOKEN_INVALID',
        message: 'Password reset token is invalid'
      });
    }

    const issues = getPasswordStrengthIssues(password, {
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

    user.passwordHash = await hashPassword(password);
    user.passwordChangedAt = new Date();
    user.sessions = [];

    await clearPasswordResetState(user);

    logAuth('info', 'password reset completed', { userId: user._id.toString() });

    return res.status(200).json({
      code: 'PASSWORD_RESET_SUCCESS',
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.validated?.body || req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      logAuth('warn', 'login failed: user not found', {
        identifierHash: anonymizeIdentifier(normalizedEmail)
      });
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      logAuth('warn', 'login blocked: inactive user', { userId: user._id.toString() });
      return res.status(403).json({ code: 'ACCOUNT_INACTIVE', message: 'Account is inactive' });
    }

    if (!user.emailVerified) {
      logAuth('warn', 'login blocked: email not verified', { userId: user._id.toString() });
      return res
        .status(403)
        .json({ code: 'EMAIL_NOT_VERIFIED', message: 'Verify your email to continue' });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      logAuth('warn', 'login failed: wrong password', { userId: user._id.toString() });
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    const tokens = await createAuthTokens(user);

    logAuth('info', 'user logged in', { userId: user._id.toString() });

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
