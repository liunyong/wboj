import { Router } from 'express';

import { getUserDashboard, updateProfileVisibility } from '../controllers/userController.js';
import { authenticateOptional, requireAuth } from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import { profileVisibilitySchema, usernameParamSchema } from '../validation/userSchemas.js';

const router = Router();

router.put(
  '/me/profile',
  requireAuth,
  validate({ body: profileVisibilitySchema }),
  updateProfileVisibility
);

router.get(
  '/:username/dashboard',
  authenticateOptional,
  validate({ params: usernameParamSchema }),
  getUserDashboard
);

export default router;
