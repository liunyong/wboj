import { Router } from 'express';

import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement
} from '../controllers/announcementController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { listRateLimiter } from '../middlewares/rateLimiters.js';
import validate from '../middlewares/validate.js';
import {
  announcementCreateSchema,
  announcementIdParamSchema,
  announcementListQuerySchema,
  announcementUpdateSchema
} from '../validation/announcementSchemas.js';

const router = Router();

router.get('/', listRateLimiter, validate({ query: announcementListQuerySchema }), listAnnouncements);
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  validate({ body: announcementCreateSchema }),
  createAnnouncement
);
router.put(
  '/:id',
  requireAuth,
  requireRole('admin'),
  validate({ params: announcementIdParamSchema, body: announcementUpdateSchema }),
  updateAnnouncement
);
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  validate({ params: announcementIdParamSchema }),
  deleteAnnouncement
);

export default router;
