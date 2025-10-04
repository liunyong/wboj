import { Router } from 'express';
import { createSubmission, listSubmissions, getSubmission } from '../controllers/submissionController.js';
import validate from '../middlewares/validate.js';
import {
  createSubmissionSchema,
  listSubmissionsQuerySchema,
  submissionIdParamSchema
} from '../validation/submissionSchemas.js';

const router = Router();

router.get('/', validate({ query: listSubmissionsQuerySchema }), listSubmissions);
router.get('/:id', validate({ params: submissionIdParamSchema }), getSubmission);
router.post('/', validate({ body: createSubmissionSchema }), createSubmission);

export default router;
