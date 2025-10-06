import mongoose from 'mongoose';
import { z } from 'zod';

const isObjectId = (value) => mongoose.isValidObjectId(value);

const verdictEnum = z.enum(['PENDING', 'AC', 'WA', 'TLE', 'RTE', 'CE', 'MLE', 'PE', 'IE']);

const coerceLanguageId = z.union([
  z.coerce.number().int().positive('languageId must be a positive integer'),
  z
    .string()
    .min(1, 'languageId is required')
    .regex(/^[0-9]+$/, 'languageId must be numeric')
    .transform((value) => Number.parseInt(value, 10))
]);

const sourceSchema = z
  .string()
  .min(1, 'source is required')
  .max(100_000, 'source is too large');

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
    languageId: coerceLanguageId.optional(),
    lang: coerceLanguageId.optional(),
    sourceCode: sourceSchema.optional(),
    source: sourceSchema.optional()
  })
  .strict()
  .refine((data) => data.languageId !== undefined || data.lang !== undefined, {
    message: 'languageId is required'
  })
  .refine((data) => data.sourceCode !== undefined || data.source !== undefined, {
    message: 'sourceCode is required'
  })
  .transform((data) => ({
    problemId: data.problemId,
    languageId: data.languageId ?? data.lang,
    sourceCode: data.sourceCode ?? data.source
  }));

export const mySubmissionsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    problemId: z
      .string()
      .refine((value) => !value || isObjectId(value), 'problemId must be a valid ObjectId')
      .optional(),
    verdict: verdictEnum.optional()
  })
  .strict();

export const adminListSubmissionsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).optional().default(100),
    problemId: z
      .string()
      .refine((value) => !value || isObjectId(value), 'problemId must be a valid ObjectId')
      .optional(),
    userId: z
      .string()
      .refine((value) => !value || isObjectId(value), 'userId must be a valid ObjectId')
      .optional(),
    verdict: verdictEnum.optional()
  })
  .strict();
