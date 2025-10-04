import { Router } from 'express';
import {
  getProblems,
  getProblem,
  createProblem,
  updateProblem,
  deleteProblem
} from '../controllers/problemController.js';
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

router.get('/', validate({ query: listProblemsQuerySchema }), getProblems);
router.get(
  '/:idOrSlug',
  validate({ params: problemIdentifierParamSchema, query: getProblemQuerySchema }),
  getProblem
);
router.post('/', validate({ body: createProblemSchema }), createProblem);
router.patch('/:id', validate({ params: problemIdParamSchema, body: updateProblemSchema }), updateProblem);
router.delete('/:id', validate({ params: problemIdParamSchema }), deleteProblem);

export default router;
