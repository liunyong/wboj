import { z } from 'zod';
import { testCaseSchema } from './problemSchemas.js';

const validationTestCaseSchema = testCaseSchema.extend({
  index: z.coerce.number().int().min(1).max(9999).optional()
});

export const judgeValidationSchema = z
  .object({
    sourceCode: z.string().min(1, 'Source code is required'),
    languageId: z.coerce.number().int().positive('Language id must be positive'),
    testCases: z
      .array(validationTestCaseSchema)
      .min(1, 'At least one test case is required')
      .max(500, 'A maximum of 500 test cases is supported'),
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
  .strict();
