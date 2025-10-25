import crypto from 'node:crypto';

import {
  APP_BASE_URL,
  EMAIL_VERIFICATION_EXPIRES_MIN,
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MS
} from '../config/email.js';
import User from '../models/User.js';
import { sendEmail } from './emailService.js';

const HASH_ALGORITHM = 'sha256';
const TOKEN_BYTES = 48;

const verificationTtlMs = Math.max(1, EMAIL_VERIFICATION_EXPIRES_MIN) * 60 * 1000;

const hashToken = (token) =>
  crypto.createHash(HASH_ALGORITHM).update(token, 'utf8').digest('hex');

const createToken = () => crypto.randomBytes(TOKEN_BYTES).toString('hex');

const buildVerificationUrl = (email, token) =>
  `${APP_BASE_URL.replace(/\/+$/, '')}/auth/verify?email=${encodeURIComponent(
    email
  )}&token=${encodeURIComponent(token)}`;

const buildEmailContent = ({ username, email, verificationUrl, expiresAt }) => {
  const subject = 'Verify your email address';
  const text = [
    `Hi ${username || email},`,
    '',
    'Welcome to Wanbang Online Judge!',
    'Please verify your email address to activate your account:',
    verificationUrl,
    '',
    `This link will expire on ${expiresAt.toUTCString()}.`,
    '',
    'If you did not create this account, you can safely ignore this email.'
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Verify your email</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
    <h1 style="font-size: 20px; margin-bottom: 16px;">Welcome to Wanbang Online Judge</h1>
    <p style="margin-bottom: 16px;">Hi ${username || email},</p>
    <p style="margin-bottom: 16px;">
      Thanks for creating an account. Please confirm your email address to activate your profile.
    </p>
    <p style="margin-bottom: 24px;">
      <a href="${verificationUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
        Verify Email
      </a>
    </p>
    <p style="margin-bottom: 8px;">
      If the button doesn&rsquo;t work, copy and paste this link into your browser:
    </p>
    <p style="word-break: break-all; margin-bottom: 16px;">
      <a href="${verificationUrl}">${verificationUrl}</a>
    </p>
    <p style="margin-bottom: 16px;">This link expires on ${expiresAt.toUTCString()}.</p>
    <p style="margin-bottom: 0;">If you didn&rsquo;t create this account, please ignore this message.</p>
  </body>
</html>`;

  return { subject, text, html };
};

export const ensureUserCanResendVerification = (user) => {
  const sentAt = user.emailVerificationSentAt?.getTime();
  if (!sentAt) {
    return true;
  }
  return Date.now() - sentAt >= EMAIL_VERIFICATION_RESEND_COOLDOWN_MS;
};

export const issueEmailVerification = async (user) => {
  const token = createToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + verificationTtlMs);

  user.emailVerificationTokenHash = tokenHash;
  user.emailVerificationExpires = expiresAt;
  user.emailVerificationSentAt = now;
  await user.save();

  const verificationUrl = buildVerificationUrl(user.email, token);
  const { subject, text, html } = buildEmailContent({
    username: user.username,
    email: user.email,
    verificationUrl,
    expiresAt
  });

  await sendEmail({
    to: user.email,
    subject,
    text,
    html
  });

  return { token, verificationUrl, expiresAt };
};

export const verifyEmailToken = async ({ email, token }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedToken = token.trim();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return { status: 'not_found' };
  }

  if (user.emailVerified) {
    return { status: 'already_verified', user };
  }

  if (!user.emailVerificationTokenHash || !normalizedToken) {
    return { status: 'invalid', user };
  }

  const tokenHash = hashToken(normalizedToken);
  if (tokenHash !== user.emailVerificationTokenHash) {
    return { status: 'invalid', user };
  }

  if (!user.emailVerificationExpires || user.emailVerificationExpires.getTime() < Date.now()) {
    return { status: 'expired', user };
  }

  user.emailVerified = true;
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpires = null;
  user.emailVerificationSentAt = null;
  await user.save();

  return { status: 'verified', user };
};

export const resetEmailVerificationState = async (user) => {
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpires = null;
  user.emailVerificationSentAt = null;
  await user.save();
};
