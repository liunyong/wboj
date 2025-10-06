import { z } from 'zod';

export const dashboardYearQuerySchema = z
  .object({
    year: z
      .string()
      .regex(/^\d{4}$/, 'Year must be a 4-digit value')
      .optional()
  })
  .strict();
