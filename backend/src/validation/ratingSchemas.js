import { z } from 'zod';

export const difficultyUpdateSchema = z.object({
  difficultyRating: z.number().int().min(800).max(4000).nullable(),
  expectedVersion: z.number().int().min(0),
  expectedUpdatedAt: z.string().datetime()
}).strict();

export const seasonSchema = z.object({
  name: z.string().trim().min(1).max(80),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  active: z.boolean().default(true)
}).strict().refine((value) => new Date(value.startDate) < new Date(value.endDate), {
  message: 'End date must be after start date', path: ['endDate']
});

export const leaderboardQuerySchema = z.object({
  scope: z.enum(['overall', 'season']).default('overall'),
  seasonId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
}).strict();
