import { Router } from 'express';
import multer from '../utils/multerAdapter.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { uploadImageRateLimiter } from '../middlewares/rateLimiters.js';
import {
  uploadProblemImage,
  listProblemImages,
  deleteProblemImage
} from '../controllers/uploadController.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

router.post(
  '/images',
  requireAuth,
  uploadImageRateLimiter,
  upload.single('file'),
  uploadProblemImage
);

router.get('/images', requireAuth, requireRole('admin'), listProblemImages);

router.delete('/images/:filename', requireAuth, requireRole('admin'), deleteProblemImage);

export default router;
