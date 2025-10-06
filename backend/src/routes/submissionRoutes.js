import { Router } from 'express';
import {
  createSubmission,
  getSubmission,
  listMySubmissions,
  listSubmissions
} from '../controllers/submissionController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import {
  adminListSubmissionsQuerySchema,
  createSubmissionSchema,
  mySubmissionsQuerySchema,
  submissionIdParamSchema
} from '../validation/submissionSchemas.js';

const router = Router();

router.get('/mine', requireAuth, validate({ query: mySubmissionsQuerySchema }), listMySubmissions);
router.get(
  '/',
  requireAuth,
  requireRole('admin'),
  validate({ query: adminListSubmissionsQuerySchema }),
  listSubmissions
);
router.get('/:id', requireAuth, validate({ params: submissionIdParamSchema }), getSubmission);
router.post('/', requireAuth, validate({ body: createSubmissionSchema }), createSubmission);

export default router;
