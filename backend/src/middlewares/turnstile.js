import { verifyTurnstileToken } from '../services/turnstileService.js';

export const requireTurnstile = (expectedAction) => async (req, res, next) => {
  const result = await verifyTurnstileToken({
    token: req.validated?.body?.turnstileToken ?? req.body?.turnstileToken,
    remoteIp: req.ip,
    expectedAction
  });

  if (!result.success) {
    return res.status(403).json({
      code: 'TURNSTILE_FAILED',
      message: result.errorCodes.includes('missing-secret-key')
        ? 'Security verification is not configured on the server'
        : 'Security verification failed. Please try again.'
    });
  }
  return next();
};
