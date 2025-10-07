import { z } from 'zod';

const sampleSchema = z.object({
  input: z.string().min(1, 'Sample input is required'),
  output: z.string().min(1, 'Sample output is required'),
  explanation: z
    .string()
    .max(2000, 'Explanation must be 2000 characters or fewer')
    .optional()
    .transform((value) => value || undefined)
});

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

const tagsArraySchema = z
  .array(
    z
      .string()
      .min(1, 'Tag must contain at least one character')
      .max(50, 'Tag must be 50 characters or fewer')
  )
  .max(20, 'A maximum of 20 tags is supported')
  .transform((value) => value.map((tag) => tag.trim()).filter((tag) => tag !== ''));

const judge0LanguageIdsSchema = z
  .array(z.coerce.number().int().positive('Language id must be positive'))
  .min(1, 'At least one language id is required');

export const listProblemsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    visibility: z.enum(['all', 'public', 'private']).default('public'),
    difficulty: z.enum(['BASIC', 'EASY', 'MEDIUM', 'HARD']).optional()
  })
  .strict();

export const problemIdParamSchema = z
  .object({
    problemId: z
      .coerce.number()
      .int()
      .min(1, 'Problem id must be a positive integer')
  })
  .strict();

export const legacySlugParamSchema = z
  .object({
    slug: z.string().min(1, 'Problem slug is required')
  })
  .strict();

export const createProblemSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    statement: z.string().min(1, 'Statement is required'),
    inputFormat: z.string().optional().transform((value) => value || undefined),
    outputFormat: z.string().optional().transform((value) => value || undefined),
    constraints: z.string().optional().transform((value) => value || undefined),
    difficulty: z.enum(['BASIC', 'EASY', 'MEDIUM', 'HARD']).default('BASIC'),
    tags: tagsArraySchema.optional().default([]),
    samples: z.array(sampleSchema).optional().default([]),
    judge0LanguageIds: judge0LanguageIdsSchema.optional().default([71]),
    testCases: z
      .array(testCaseSchema)
      .min(1, 'At least one test case is required'),
    isPublic: z.boolean().optional().default(true),
    algorithms: z
      .array(z.string().min(1, 'Algorithm name is required').max(60, 'Algorithm name is too long'))
      .max(10, 'A maximum of 10 algorithms is supported')
      .optional()
      .default([])
      .transform((value) =>
        Array.from(new Set(value.map((item) => item.trim()).filter((item) => item !== '')))
      )
  })
  .strict();

export const getProblemQuerySchema = z
  .object({
    includePrivate: z.coerce.boolean().optional().default(false)
  })
  .strict();

export const updateVisibilitySchema = z
  .object({
    isPublic: z.boolean({
      required_error: 'isPublic is required',
      invalid_type_error: 'isPublic must be a boolean'
    })
  })
  .strict();
