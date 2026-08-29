import { Router } from 'express';

import {
  deleteUsersPermanently,
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
  bulkDeleteUsersSchema,
  updateUserRoleSchema,
  userActivationSchema,
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
  requireRole('super_admin'),
  validate({ params: userIdParamSchema, body: updateUserRoleSchema }),
  updateUserRole
);

router.delete(
  '/bulk',
  requireAuth,
  requireRole('super_admin'),
  validate({ body: bulkDeleteUsersSchema }),
  deleteUsersPermanently
);

router.patch(
  '/:id/deactivate',
  requireAuth,
  requireRole('super_admin'),
  validate({ params: userIdParamSchema, body: userActivationSchema }),
  updateUserStatus
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('super_admin'),
  validate({ params: userIdParamSchema }),
  deleteUsersPermanently
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
