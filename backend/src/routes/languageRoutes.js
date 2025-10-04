import { Router } from 'express';
import { listLanguages } from '../controllers/languageController.js';
import validate from '../middlewares/validate.js';
import { listLanguagesQuerySchema } from '../validation/languageSchemas.js';

const router = Router();

router.get('/', validate({ query: listLanguagesQuerySchema }), listLanguages);

export default router;
