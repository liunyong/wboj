import mongoose from 'mongoose';
import { z } from 'zod';

const isObjectId = (value) => mongoose.isValidObjectId(value);

export const userIdParamSchema = z
  .object({
    id: z
      .string()
      .min(1, 'User id is required')
      .refine((value) => isObjectId(value), 'User id must be a valid ObjectId')
  })
  .strict();

export const updateUserRoleSchema = z
  .object({
    role: z.enum(['admin', 'user'])
  })
  .strict();

export const updateUserStatusSchema = z
  .object({
    isActive: z.boolean()
  })
  .strict();

export const listUsersQuerySchema = z
  .object({
    search: z.string().max(64).optional(),
    role: z.enum(['admin', 'user']).optional(),
    isActive: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50)
  })
  .strict();
