import { Router } from 'express';
import { getMyRating, getLeaderboard, listSeasons, createSeason } from '../controllers/ratingController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { listRateLimiter } from '../middlewares/rateLimiters.js';
import validate from '../middlewares/validate.js';
import { leaderboardQuerySchema, seasonSchema } from '../validation/ratingSchemas.js';

const router = Router();
router.get('/me', requireAuth, getMyRating);
router.get('/leaderboard', listRateLimiter, validate({ query: leaderboardQuerySchema }), getLeaderboard);
router.get('/seasons', listRateLimiter, listSeasons);
router.post('/seasons', requireAuth, requireRole('admin'), validate({ body: seasonSchema }), createSeason);
export default router;
