import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  login,
  logout,
  me,
  refresh,
  register,
  updatePassword,
  updateProfile
} from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import {
  loginSchema,
  logoutSchema,
  passwordUpdateSchema,
  profileUpdateSchema,
  refreshTokenSchema,
  registerSchema
} from '../validation/authSchemas.js';
import {
  getRateLimitKeyFromIp,
  getSharedRateLimitStore
} from '../utils/rateLimitStoreFactory.js';

const router = Router();

const debugAuth = () => process.env.DEBUG_AUTH === '1';
const sharedStore = getSharedRateLimitStore();

const createRateLimitHandler =
  (keyGenerator) =>
  (req, res, _next, options) => {
    if (debugAuth()) {
      console.warn('[auth] rate limit exceeded', {
        route: req.originalUrl,
        key: keyGenerator ? keyGenerator(req) : getRateLimitKeyFromIp(req),
        limit: options.limit,
        windowMs: options.windowMs
      });
    }
    res.status(options.statusCode).json(options.message);
  };

const loginKeyGenerator = (req) => {
  const identifier =
    typeof req.body?.email === 'string'
      ? req.body.email
      : typeof req.body?.usernameOrEmail === 'string'
      ? req.body.usernameOrEmail
      : null;
  if (identifier) {
    return identifier.trim().toLowerCase();
  }
  return getRateLimitKeyFromIp(req);
};

const registerKeyGenerator = (req) => {
  const ipKey = getRateLimitKeyFromIp(req);
  const agent =
    typeof req.headers['user-agent'] === 'string'
      ? req.headers['user-agent'].slice(0, 120)
      : 'unknown-agent';
  return `${ipKey}:${agent}`;
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  keyGenerator: loginKeyGenerator,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: sharedStore ?? undefined,
  message: {
    code: 'RATE_LIMITED',
    message: 'Too many login attempts, please try again later'
  },
  handler: createRateLimitHandler(loginKeyGenerator)
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 50,
  keyGenerator: registerKeyGenerator,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: sharedStore ?? undefined,
  message: {
    code: 'RATE_LIMITED',
    message: 'Too many signups, please try again later'
  },
  handler: createRateLimitHandler(registerKeyGenerator)
});

const maybeApplyLimiter = (limiter) => (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return limiter(req, res, next);
  }
  return next();
};

router.post('/register', maybeApplyLimiter(registerLimiter), validate({ body: registerSchema }), register);
router.post('/login', maybeApplyLimiter(loginLimiter), validate({ body: loginSchema }), login);
router.post('/refresh', validate({ body: refreshTokenSchema }), refresh);
router.post('/logout', validate({ body: logoutSchema }), logout);
router.get('/me', requireAuth, me);
router.patch('/me/profile', requireAuth, validate({ body: profileUpdateSchema }), updateProfile);
router.patch('/me/password', requireAuth, validate({ body: passwordUpdateSchema }), updatePassword);

export default router;
