import { Router } from 'express';
import { listUsers, updateUserRole, updateUserStatus } from '../controllers/userController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import {
  listUsersQuerySchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  userIdParamSchema
} from '../validation/userSchemas.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin'), validate({ query: listUsersQuerySchema }), listUsers);
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

export default router;
