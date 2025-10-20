import { Router } from 'express';

import { extendSession, getSessionState } from '../controllers/sessionController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/state', requireAuth, getSessionState);
router.post('/extend', requireAuth, extendSession);

export default router;
