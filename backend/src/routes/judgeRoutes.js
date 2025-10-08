import { Router } from 'express';
import { validateSolution } from '../controllers/judgeController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import { judgeValidationSchema } from '../validation/judgeSchemas.js';

const router = Router();

router.post(
  '/validate',
  requireAuth,
  requireRole('admin'),
  validate({ body: judgeValidationSchema }),
  validateSolution
);

export default router;
