import { Router } from 'express';
import {
  getProblems,
  getProblem,
  createProblem,
  updateProblem,
  deleteProblem
} from '../controllers/problemController.js';
import { authenticateOptional, requireAuth, requireRole } from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import {
  createProblemSchema,
  getProblemQuerySchema,
  listProblemsQuerySchema,
  problemIdParamSchema,
  problemIdentifierParamSchema,
  updateProblemSchema
} from '../validation/problemSchemas.js';

const router = Router();

router.get('/', authenticateOptional, validate({ query: listProblemsQuerySchema }), getProblems);
router.get(
  '/:idOrSlug',
  authenticateOptional,
  validate({ params: problemIdentifierParamSchema, query: getProblemQuerySchema }),
  getProblem
);
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  validate({ body: createProblemSchema }),
  createProblem
);
router.patch(
  '/:id',
  requireAuth,
  requireRole('admin'),
  validate({ params: problemIdParamSchema, body: updateProblemSchema }),
  updateProblem
);
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  validate({ params: problemIdParamSchema }),
  deleteProblem
);

export default router;
