import { Router } from 'express';
import { listRanking } from '../controllers/rankingController.js';

const router = Router();

router.get('/', listRanking);

export default router;
