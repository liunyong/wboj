import { Router } from 'express';
import {
  getProblems,
  getProblemById,
  getProblemBySlug,
  createProblem,
  updateProblemVisibility,
  deleteProblem,
  getProblemAlgorithms
} from '../controllers/problemController.js';
import { authenticateOptional, requireAuth, requireRole } from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import {
  createProblemSchema,
  getProblemQuerySchema,
  listProblemsQuerySchema,
  problemIdParamSchema,
  legacySlugParamSchema,
  updateVisibilitySchema
} from '../validation/problemSchemas.js';

const router = Router();

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

export default router;
