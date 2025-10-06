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

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' }
});

router.post('/register', authLimiter, validate({ body: registerSchema }), register);
router.post('/login', authLimiter, validate({ body: loginSchema }), login);
router.post('/refresh', validate({ body: refreshTokenSchema }), refresh);
router.post('/logout', validate({ body: logoutSchema }), logout);
router.get('/me', requireAuth, me);
router.patch('/me/profile', requireAuth, validate({ body: profileUpdateSchema }), updateProfile);
router.patch('/me/password', requireAuth, validate({ body: passwordUpdateSchema }), updatePassword);

export default router;
