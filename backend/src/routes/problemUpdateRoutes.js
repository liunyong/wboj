import { Router } from 'express';

import { listProblemUpdates } from '../controllers/problemUpdateController.js';
import { listRateLimiter } from '../middlewares/rateLimiters.js';
import validate from '../middlewares/validate.js';
import { problemUpdateListQuerySchema } from '../validation/problemUpdateSchemas.js';

const router = Router();

router.get(
  '/',
  listRateLimiter,
  validate({ query: problemUpdateListQuerySchema }),
  listProblemUpdates
);

export default router;
