import { z } from 'zod';

const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(32, 'Username must be 32 characters or fewer')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be 128 characters or fewer');

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: z.string().email('Provide a valid email address'),
    password: passwordSchema
  })
  .strict();

export const loginSchema = z
  .object({
    usernameOrEmail: z.string().min(1, 'Username or email is required'),
    password: z.string().min(1, 'Password is required')
  })
  .strict();

export const logoutSchema = z
  .object({
    refreshToken: z.string().min(1, 'Refresh token is required')
  })
  .strict();

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1, 'Refresh token is required')
  })
  .strict();

export const profileUpdateSchema = z
  .object({
    displayName: z
      .string()
      .max(64, 'Display name must be 64 characters or fewer')
      .optional()
      .transform((value) => value ?? undefined),
    bio: z
      .string()
      .max(1024, 'Bio must be 1024 characters or fewer')
      .optional()
      .transform((value) => value ?? undefined),
    avatarUrl: z
      .string()
      .url('Avatar URL must be a valid URL')
      .optional()
      .transform((value) => value ?? undefined)
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update'
  });

export const passwordUpdateSchema = z
  .object({
    currentPassword: passwordSchema,
    newPassword: passwordSchema
  })
  .strict()
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must differ from current password'
  });
