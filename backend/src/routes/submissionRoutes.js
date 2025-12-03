import { Router } from 'express';
import {
  createSubmission,
  deleteSubmission,
  getSubmission,
  getSubmissionUpdates,
  listMySubmissions,
  listSubmissions,
  resubmitSubmission,
  streamSubmissions
} from '../controllers/submissionController.js';
import { authenticateOptional, requireAuth, requireRole } from '../middlewares/auth.js';
import {
  listRateLimiter,
  resubmitRateLimiter,
  submitRateLimiter
} from '../middlewares/rateLimiters.js';
import validate from '../middlewares/validate.js';
import {
  createSubmissionSchema,
  listSubmissionsQuerySchema,
  mySubmissionsQuerySchema,
  submissionIdParamSchema,
  submissionUpdatesQuerySchema
} from '../validation/submissionSchemas.js';

const router = Router();

router.get('/mine', requireAuth, validate({ query: mySubmissionsQuerySchema }), listMySubmissions);
router.get(
  '/',
  authenticateOptional,
  listRateLimiter,
  validate({ query: listSubmissionsQuerySchema }),
  listSubmissions
);
router.get(
  '/updates',
  requireAuth,
  listRateLimiter,
  validate({ query: submissionUpdatesQuerySchema }),
  getSubmissionUpdates
);
router.get('/stream', requireAuth, streamSubmissions);
router.get('/:id', authenticateOptional, validate({ params: submissionIdParamSchema }), getSubmission);
router.post(
  '/',
  requireAuth,
  submitRateLimiter,
  validate({ body: createSubmissionSchema }),
  createSubmission
);
router.patch(
  '/:id/resubmit',
  requireAuth,
  resubmitRateLimiter,
  validate({ params: submissionIdParamSchema }),
  resubmitSubmission
);
router.delete(
  '/:id',
  requireAuth,
  requireRole('super_admin'),
  validate({ params: submissionIdParamSchema }),
  deleteSubmission
);

export default router;
