import { Router } from 'express';

import {
  deleteUserKeepSubmissions,
  listUsers,
  updateUserRole,
  updateUserStatus
} from '../controllers/userController.js';
import { listUserSubmissionsAsAdmin } from '../controllers/submissionController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { adminListRateLimiter } from '../middlewares/rateLimiters.js';
import validate from '../middlewares/validate.js';
import {
  listUsersQuerySchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  userIdParamSchema
} from '../validation/userSchemas.js';
import { adminListSubmissionsQuerySchema } from '../validation/submissionSchemas.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  requireRole('admin'),
  validate({ query: listUsersQuerySchema }),
  listUsers
);

router.patch(
  '/:id/role',
  requireAuth,
  requireRole('admin'),
  validate({ params: userIdParamSchema, body: updateUserRoleSchema }),
  updateUserRole
);

router.patch(
  '/:id/status',
  requireAuth,
  requireRole('admin'),
  validate({ params: userIdParamSchema, body: updateUserStatusSchema }),
  updateUserStatus
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  validate({ params: userIdParamSchema }),
  deleteUserKeepSubmissions
);

router.get(
  '/:id/submissions',
  requireAuth,
  requireRole('admin'),
  adminListRateLimiter,
  validate({
    params: userIdParamSchema,
    query: adminListSubmissionsQuerySchema
  }),
  listUserSubmissionsAsAdmin
);

export default router;
