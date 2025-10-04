import mongoose from 'mongoose';
import { z } from 'zod';

const isObjectId = (value) => mongoose.isValidObjectId(value);

const testCaseSchema = z.object({
  input: z.string().min(1, 'Input is required'),
  expectedOutput: z.string().min(1, 'Expected output is required'),
  isPublic: z.boolean().optional().default(false),
  inputFileName: z
    .string()
    .max(255, 'inputFileName must be 255 characters or fewer')
    .optional()
    .transform((value) => value || undefined),
  outputFileName: z
    .string()
    .max(255, 'outputFileName must be 255 characters or fewer')
    .optional()
    .transform((value) => value || undefined)
});

export const listProblemsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    visibility: z.enum(['all', 'public', 'private']).default('all')
  })
  .strict();

export const problemIdentifierParamSchema = z
  .object({
    idOrSlug: z.string().min(1, 'Problem identifier is required')
  })
  .strict();

export const problemIdParamSchema = z
  .object({
    id: z
      .string()
      .min(1, 'Problem id is required')
      .refine((value) => isObjectId(value), 'Problem id must be a valid ObjectId')
  })
  .strict();

export const createProblemSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    slug: z
      .string()
      .min(1, 'Slug is required')
      .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'),
    description: z.string().min(1, 'Description is required'),
    judge0LanguageIds: z
      .array(z.coerce.number().int().positive('Language id must be positive'))
      .min(1, 'At least one language id is required')
      .optional()
      .default([71]),
    testCases: z
      .array(testCaseSchema)
      .min(1, 'At least one test case is required')
  })
  .strict();

export const updateProblemSchema = createProblemSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update'
  })
  .refine(
    (data) => !(data.testCases && data.testCases.length === 0),
    'testCases cannot be empty when provided'
  )
  .refine(
    (data) => !(data.judge0LanguageIds && data.judge0LanguageIds.length === 0),
    'judge0LanguageIds cannot be empty when provided'
  );

export const getProblemQuerySchema = z
  .object({
    includePrivate: z.coerce.boolean().optional().default(false)
  })
  .strict();
