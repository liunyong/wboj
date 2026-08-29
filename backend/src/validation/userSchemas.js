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

export const usernameParamSchema = z
  .object({
    username: z
      .string()
      .min(1, 'Username is required')
      .max(64, 'Username is too long')
  })
  .strict();

export const updateUserRoleSchema = z
  .object({
    role: z.enum(['user', 'admin', 'super_admin'])
  })
  .strict();

export const userActivationSchema = z
  .object({
    isActive: z.boolean().optional()
  })
  .strict();

export const listUsersQuerySchema = z
  .object({
    search: z.string().max(64).optional(),
    role: z.enum(['user', 'admin', 'super_admin']).optional(),
    isActive: z
      .preprocess(
        (value) => (value === 'true' ? true : value === 'false' ? false : value),
        z.boolean()
      )
      .optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25)
  })
  .strict();

export const bulkDeleteUsersSchema = z
  .object({
    ids: z
      .array(z.string().refine((value) => isObjectId(value), 'Each user id must be valid'))
      .min(1, 'Select at least one user')
      .max(100, 'At most 100 users can be deleted at once')
      .transform((ids) => [...new Set(ids)])
  })
  .strict();

export const profileVisibilitySchema = z
  .object({
    profilePublic: z.coerce.boolean()
  })
  .strict();
