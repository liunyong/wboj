import mongoose from 'mongoose';
import { z } from 'zod';

const isObjectId = (value) => mongoose.isValidObjectId(value);

export const announcementListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    pinnedFirst: z.coerce.boolean().optional().default(true)
  })
  .strict();

export const announcementCreateSchema = z
  .object({
    title: z.string().min(1).max(160),
    body: z.string().min(1),
    pinned: z.coerce.boolean().optional().default(false)
  })
  .strict();

export const announcementUpdateSchema = z
  .object({
    title: z.string().min(1).max(160).optional(),
    body: z.string().min(1).optional(),
    pinned: z.coerce.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided for update'
  });

export const announcementIdParamSchema = z
  .object({
    id: z
      .string()
      .min(1, 'Announcement id is required')
      .refine((value) => isObjectId(value), 'Announcement id must be a valid ObjectId')
  })
  .strict();
