import { Router } from 'express';
import {
  createSubmission,
  getSubmission,
  getSubmissionUpdates,
  listMySubmissions,
  listSubmissions,
  resubmitSubmission,
  streamSubmissions
} from '../controllers/submissionController.js';
import { requireAuth } from '../middlewares/auth.js';
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
  requireAuth,
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
router.get('/:id', requireAuth, validate({ params: submissionIdParamSchema }), getSubmission);
router.post(
  '/',
  requireAuth,
  submitRateLimiter,
  validate({ body: createSubmissionSchema }),
  createSubmission
);
router.post(
  '/:id/resubmit',
  requireAuth,
  resubmitRateLimiter,
  validate({ params: submissionIdParamSchema }),
  resubmitSubmission
);

export default router;
