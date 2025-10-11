import { z } from 'zod';

export const problemUpdateListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20)
  })
  .strict();
