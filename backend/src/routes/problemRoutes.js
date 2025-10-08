import { Router } from 'express';
import multer from 'multer';
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
import { authenticateOptional, requireAuth, requireRole } from '../middlewares/auth.js';
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
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  validate({ body: createProblemSchema }),
  createProblem
);
router.patch(
  '/:problemId',
  requireAuth,
  requireRole('admin'),
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
