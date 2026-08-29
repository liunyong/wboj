import { env } from '../config/env.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const isTurnstileConfigured = () => Boolean(env.turnstileSecretKey);

export const verifyTurnstileToken = async ({ token, remoteIp, expectedAction }) => {
  if (env.nodeEnv === 'test') {
    return { success: true, errorCodes: [] };
  }

  if (!isTurnstileConfigured()) {
    return { success: !env.isProduction, errorCodes: ['missing-secret-key'] };
  }

  if (!token) {
    return { success: false, errorCodes: ['missing-input-response'] };
  }

  const body = new URLSearchParams({
    secret: env.turnstileSecretKey,
    response: token
  });
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      return { success: false, errorCodes: ['siteverify-unavailable'] };
    }

    const result = await response.json();
    const actionMatches = !expectedAction || result.action === expectedAction;
    const hostnameMatches =
      !env.turnstileExpectedHostname || result.hostname === env.turnstileExpectedHostname;

    return {
      success: Boolean(result.success && actionMatches && hostnameMatches),
      errorCodes: result['error-codes'] ?? [],
      action: result.action,
      hostname: result.hostname
    };
  } catch (_error) {
    return { success: false, errorCodes: ['siteverify-unavailable'] };
  }
};
