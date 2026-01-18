import { z } from 'zod';

const sampleSchema = z.object({
  input: z.string().min(1, 'Sample input is required'),
  output: z.string().min(1, 'Sample output is required'),
  explanation: z
    .string()
    .max(2000, 'Explanation must be 2000 characters or fewer')
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    })
});

export const testCaseSchema = z.object({
  input: z.string().min(1, 'Input is required'),
  output: z.string().min(1, 'Output is required'),
  points: z
    .coerce.number()
    .int('Points must be an integer')
    .min(1, 'Points must be at least 1')
    .max(1000, 'Points must be at most 1000')
    .optional()
    .default(1)
});

const normalizeTagsArray = (value = []) =>
  Array.from(new Set(value.map((tag) => tag.trim()).filter((tag) => tag !== '')));

const tagsArraySchema = z
  .array(
    z
      .string()
      .min(1, 'Tag must contain at least one character')
      .max(50, 'Tag must be 50 characters or fewer')
  )
  .max(20, 'A maximum of 20 tags is supported')
  .transform((value) => normalizeTagsArray(value));

const judge0LanguageIdsSchema = z
  .array(z.coerce.number().int().positive('Language id must be positive'))
  .min(1, 'At least one language id is required');

const buildStatementSchema = (message) =>
  z
    .string()
    .min(1, message)
    .refine((value) => value.trim().length > 0, message);

const statementOptionalTransform = (value) => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const sourceOptionalTransform = (value) => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

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
    title: z
      .string()
      .trim()
      .min(1, 'Title is required'),
    statement: buildStatementSchema('Statement is required').optional(),
    statementMd: buildStatementSchema('Statement markdown is required').optional(),
    statementHtmlCache: z.string().optional().transform(statementOptionalTransform),
    source: z
      .string()
      .max(200, 'Source must be 200 characters or fewer')
      .optional()
      .transform(sourceOptionalTransform),
    inputFormat: z.string().optional().transform(statementOptionalTransform),
    outputFormat: z.string().optional().transform(statementOptionalTransform),
    constraints: z.string().optional().transform(statementOptionalTransform),
    difficulty: z.enum(['BASIC', 'EASY', 'MEDIUM', 'HARD']).default('BASIC'),
    tags: tagsArraySchema.optional().default([]),
    samples: z.array(sampleSchema).optional().default([]),
    judge0LanguageIds: judge0LanguageIdsSchema.optional().default([71]),
    testCases: z
      .array(testCaseSchema)
      .min(1, 'At least one test case is required')
      .max(500, 'A maximum of 500 test cases is supported'),
    isPublic: z.boolean().optional().default(true),
    algorithms: z
      .array(
        z.string().min(1, 'Algorithm name is required').max(60, 'Algorithm name is too long')
      )
      .max(10, 'A maximum of 10 algorithms is supported')
      .transform((value) =>
        Array.from(new Set(value.map((item) => item.trim()).filter((item) => item !== '')))
      )
      .optional()
      .default([]),
    cpuTimeLimit: z
      .coerce.number()
      .min(0.1, 'CPU time limit must be at least 0.1 seconds')
      .max(30, 'CPU time limit must be at most 30 seconds')
      .optional(),
    memoryLimit: z
      .coerce.number()
      .int('Memory limit must be an integer in megabytes')
      .min(16, 'Memory limit must be at least 16 MB')
      .max(1024, 'Memory limit must be at most 1024 MB')
      .optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasStatement = typeof value.statement === 'string' && value.statement.trim().length > 0;
    const hasStatementMd =
      typeof value.statementMd === 'string' && value.statementMd.trim().length > 0;
    if (!hasStatementMd && !hasStatement) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Statement markdown is required',
        path: ['statementMd']
      });
    }
  });

export const updateProblemSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required'),
    statement: buildStatementSchema('Statement is required').optional(),
    statementMd: buildStatementSchema('Statement markdown is required').optional(),
    statementHtmlCache: z.string().optional().transform(statementOptionalTransform),
    source: z
      .string()
      .max(200, 'Source must be 200 characters or fewer')
      .optional()
      .transform(sourceOptionalTransform),
    inputFormat: z.string().optional().transform(statementOptionalTransform),
    outputFormat: z.string().optional().transform(statementOptionalTransform),
    constraints: z.string().optional().transform(statementOptionalTransform),
    difficulty: z.enum(['BASIC', 'EASY', 'MEDIUM', 'HARD']).optional(),
    tags: tagsArraySchema.optional(),
    samples: z.array(sampleSchema).optional(),
    judge0LanguageIds: judge0LanguageIdsSchema.optional(),
    testCases: z
      .array(testCaseSchema)
      .min(1, 'At least one test case is required')
      .max(500, 'A maximum of 500 test cases is supported')
      .optional(),
    isPublic: z.boolean().optional(),
    algorithms: z
      .array(
        z.string().min(1, 'Algorithm name is required').max(60, 'Algorithm name is too long')
      )
      .max(10, 'A maximum of 10 algorithms is supported')
      .transform((value) =>
        Array.from(new Set(value.map((item) => item.trim()).filter((item) => item !== '')))
      )
      .optional(),
    cpuTimeLimit: z
      .coerce.number()
      .min(0.1, 'CPU time limit must be at least 0.1 seconds')
      .max(30, 'CPU time limit must be at most 30 seconds')
      .optional(),
    memoryLimit: z
      .coerce.number()
      .int('Memory limit must be an integer in megabytes')
      .min(16, 'Memory limit must be at least 16 MB')
      .max(1024, 'Memory limit must be at most 1024 MB')
      .optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasStatement = typeof value.statement === 'string' && value.statement.trim().length > 0;
    const hasStatementMd =
      typeof value.statementMd === 'string' && value.statementMd.trim().length > 0;
    if (!hasStatementMd && !hasStatement) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Statement markdown is required',
        path: ['statementMd']
      });
    }
  });

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
