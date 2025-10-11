import { Router } from 'express';
import multer from '../utils/multerAdapter.js';
import {
  getProblems,
  getProblemById,
  getProblemBySlug,
  createProblem,
  updateProblem,
  updateProblemVisibility,
  deleteProblem,
  getProblemAlgorithms,
  parseProblemTestCasesZip
} from '../controllers/problemController.js';
import {
  listProblemSubmissions,
  streamProblemSubmissions
} from '../controllers/submissionController.js';
import { authenticateOptional, requireAuth, requireRole } from '../middlewares/auth.js';
import { listRateLimiter } from '../middlewares/rateLimiters.js';
import validate from '../middlewares/validate.js';
import {
  createProblemSchema,
  getProblemQuerySchema,
  listProblemsQuerySchema,
  problemIdParamSchema,
  legacySlugParamSchema,
  updateVisibilitySchema,
  updateProblemSchema
} from '../validation/problemSchemas.js';
import {
  problemSubmissionsQuerySchema,
  submissionUpdatesQuerySchema
} from '../validation/submissionSchemas.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/', authenticateOptional, validate({ query: listProblemsQuerySchema }), getProblems);
router.get(
  '/algorithms',
  requireAuth,
  requireRole('admin'),
  getProblemAlgorithms
);
router.get('/slug/:slug', validate({ params: legacySlugParamSchema }), getProblemBySlug);
router.get(
  '/:problemId',
  authenticateOptional,
  validate({ params: problemIdParamSchema, query: getProblemQuerySchema }),
  getProblemById
);
router.get(
  '/:problemId/submissions',
  requireAuth,
  listRateLimiter,
  validate({ params: problemIdParamSchema, query: problemSubmissionsQuerySchema }),
  listProblemSubmissions
);
router.get(
  '/:problemId/submissions/stream',
  requireAuth,
  validate({ params: problemIdParamSchema, query: submissionUpdatesQuerySchema }),
  streamProblemSubmissions
);
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  validate({ body: createProblemSchema }),
  createProblem
);
router.put(
  '/:problemId',
  requireAuth,
  validate({ params: problemIdParamSchema, body: updateProblemSchema }),
  updateProblem
);
router.patch(
  '/:problemId/visibility',
  requireAuth,
  requireRole('admin'),
  validate({ params: problemIdParamSchema, body: updateVisibilitySchema }),
  updateProblemVisibility
);
router.delete(
  '/:problemId',
  requireAuth,
  requireRole('admin'),
  validate({ params: problemIdParamSchema }),
  deleteProblem
);
router.post(
  '/testcases/zip-parse',
  requireAuth,
  requireRole('admin'),
  upload.single('file'),
  parseProblemTestCasesZip
);

export default router;
