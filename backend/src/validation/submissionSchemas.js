import mongoose from 'mongoose';
import { z } from 'zod';

const isObjectId = (value) => mongoose.isValidObjectId(value);

export const submissionIdParamSchema = z
  .object({
    id: z
      .string()
      .min(1, 'Submission id is required')
      .refine((value) => isObjectId(value), 'Submission id must be a valid ObjectId')
  })
  .strict();

export const createSubmissionSchema = z
  .object({
    problemId: z
      .string()
      .min(1, 'problemId is required')
      .refine((value) => isObjectId(value), 'problemId must be a valid ObjectId'),
    languageId: z.coerce.number().int().positive('languageId must be a positive integer'),
    sourceCode: z.string().min(1, 'sourceCode is required').max(100_000, 'sourceCode is too large')
  })
  .strict();

export const listSubmissionsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    problemId: z
      .string()
      .refine((value) => !value || isObjectId(value), 'problemId must be a valid ObjectId')
      .optional()
  })
  .strict();
