import mongoose from 'mongoose';
import { z } from 'zod';

const isObjectId = (value) => mongoose.isValidObjectId(value);

const verdictEnum = z.enum(['PENDING', 'AC', 'WA', 'TLE', 'RTE', 'CE', 'MLE', 'PE', 'IE', 'PARTIAL']);
const statusEnum = z.enum([
  'queued',
  'running',
  'accepted',
  'wrong_answer',
  'tle',
  'rte',
  'ce',
  'failed'
]);

const statusFilterSchema = z
  .preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const values = Array.isArray(value) ? value : [value];
    const flattened = values
      .flatMap((item) =>
        typeof item === 'string'
          ? item
              .split(',')
              .map((part) => part.trim())
              .filter(Boolean)
          : []
      )
      .filter(Boolean);
    if (!flattened.length) {
      return undefined;
    }
    return flattened;
  }, z.array(statusEnum).nonempty())
  .optional();

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

const listSubmissionsQuerySchemaBase = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: statusFilterSchema,
    user: z
      .string()
      .trim()
      .min(1, 'user filter cannot be empty')
      .optional(),
    problemId: z
      .coerce.number()
      .int()
      .positive('problemId must be positive')
      .optional(),
    dateFrom: z
      .string()
      .optional()
      .refine(
        (value) => !value || !Number.isNaN(Date.parse(value)),
        'dateFrom must be a valid ISO date'
      ),
    dateTo: z
      .string()
      .optional()
      .refine(
        (value) => !value || !Number.isNaN(Date.parse(value)),
        'dateTo must be a valid ISO date'
      ),
    sort: z.enum(['createdAt', '-createdAt']).optional().default('-createdAt')
  })
  .strict();

export const listSubmissionsQuerySchema = listSubmissionsQuerySchemaBase;
export const adminListSubmissionsQuerySchema = listSubmissionsQuerySchemaBase;

export const problemSubmissionsQuerySchema = z
  .object({
    scope: z.enum(['mine', 'all']).optional().default('mine'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    sort: z.enum(['createdAt', '-createdAt']).optional().default('-createdAt')
  })
  .strict();

export const submissionUpdatesQuerySchema = z
  .object({
    since: z
      .string()
      .optional()
      .refine(
        (value) => !value || !Number.isNaN(Date.parse(value)),
        'since must be a valid ISO date'
      )
  })
  .strict();
