import { Router } from 'express';
import { getHeatmap, getProgress, getSummary } from '../controllers/dashboardController.js';
import { requireAuth } from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import { dashboardYearQuerySchema } from '../validation/dashboardSchemas.js';

const router = Router();

router.get('/me/summary', requireAuth, validate({ query: dashboardYearQuerySchema }), getSummary);
router.get('/me/heatmap', requireAuth, validate({ query: dashboardYearQuerySchema }), getHeatmap);
router.get('/me/progress', requireAuth, getProgress);

export default router;
