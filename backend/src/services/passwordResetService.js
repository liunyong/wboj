import crypto from 'node:crypto';

import {
  APP_BASE_URL,
  PASSWORD_RESET_EXPIRES_MIN,
  PASSWORD_RESET_RESEND_COOLDOWN_MS
} from '../config/email.js';
import User from '../models/User.js';
import { sendEmail } from './emailService.js';

const HASH_ALGORITHM = 'sha256';
const TOKEN_BYTES = 48;

const resetTtlMs = Math.max(1, PASSWORD_RESET_EXPIRES_MIN) * 60 * 1000;

const hashToken = (token) =>
  crypto.createHash(HASH_ALGORITHM).update(token, 'utf8').digest('hex');

const createToken = () => crypto.randomBytes(TOKEN_BYTES).toString('hex');

const buildResetUrl = (email, token) =>
  `${APP_BASE_URL.replace(/\/+$/, '')}/auth/reset-password?email=${encodeURIComponent(
    email
  )}&token=${encodeURIComponent(token)}`;

const buildEmailContent = ({ username, email, resetUrl, expiresAt }) => {
  const subject = 'Reset your Wanbang Online Judge password';
  const text = [
    `Hi ${username || email},`,
    '',
    'We received a request to reset your Wanbang Online Judge password.',
    'Use the link below to choose a new password:',
    resetUrl,
    '',
    `This link will expire on ${expiresAt.toUTCString()}.`,
    '',
    'If you did not request this reset, you can ignore this email.'
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Reset your password</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
    <h1 style="font-size: 20px; margin-bottom: 16px;">Password reset requested</h1>
    <p style="margin-bottom: 16px;">Hi ${username || email},</p>
    <p style="margin-bottom: 16px;">
      We received a request to reset the password for your Wanbang Online Judge account.
    </p>
    <p style="margin-bottom: 24px;">
      <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
        Choose a new password
      </a>
    </p>
    <p style="margin-bottom: 8px;">
      If the button doesn&rsquo;t work, copy and paste this link into your browser:
    </p>
    <p style="word-break: break-all; margin-bottom: 16px;">
      <a href="${resetUrl}">${resetUrl}</a>
    </p>
    <p style="margin-bottom: 16px;">This link expires on ${expiresAt.toUTCString()}.</p>
    <p style="margin-bottom: 0;">If you didn&rsquo;t request this change, please ignore this message.</p>
  </body>
</html>`;

  return { subject, text, html };
};

export const ensureUserCanRequestPasswordReset = (user) => {
  const sentAt = user.passwordResetSentAt?.getTime();
  if (!sentAt) {
    return true;
  }
  return Date.now() - sentAt >= PASSWORD_RESET_RESEND_COOLDOWN_MS;
};

export const issuePasswordReset = async (user) => {
  const token = createToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + resetTtlMs);

  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpires = expiresAt;
  user.passwordResetSentAt = now;
  await user.save();

  const resetUrl = buildResetUrl(user.email, token);
  const { subject, text, html } = buildEmailContent({
    username: user.username,
    email: user.email,
    resetUrl,
    expiresAt
  });

  await sendEmail({
    to: user.email,
    subject,
    text,
    html
  });

  return { token, resetUrl, expiresAt };
};

export const verifyPasswordResetToken = async ({ email, token }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedToken = token.trim();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return { status: 'not_found' };
  }

  if (!user.passwordResetTokenHash || !normalizedToken) {
    return { status: 'invalid', user };
  }

  const tokenHash = hashToken(normalizedToken);
  if (tokenHash !== user.passwordResetTokenHash) {
    return { status: 'invalid', user };
  }

  if (!user.passwordResetExpires || user.passwordResetExpires.getTime() < Date.now()) {
    return { status: 'expired', user };
  }

  return { status: 'valid', user };
};

export const clearPasswordResetState = async (user) => {
  user.passwordResetTokenHash = null;
  user.passwordResetExpires = null;
  user.passwordResetSentAt = null;
  await user.save();
};
