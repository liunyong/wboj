import { Router } from 'express';

import {
  extendSession,
  getSessionPolicy,
  getSessionState,
  listSessions,
  revokeSession,
  revokeSessions
} from '../controllers/sessionController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/state', requireAuth, getSessionState);
router.get('/policy', getSessionPolicy);
router.get('/sessions', requireAuth, listSessions);
router.delete('/sessions', requireAuth, revokeSessions);
router.delete('/sessions/:id', requireAuth, revokeSession);
router.post('/extend', requireAuth, extendSession);

export default router;
