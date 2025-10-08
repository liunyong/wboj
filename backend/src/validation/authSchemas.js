import { z } from 'zod';

import { getPasswordStrengthIssues } from './passwordRules.js';

const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(32, 'Username must be 32 characters or fewer')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores');

const passwordFieldSchema = z.string({ required_error: 'Password is required' });
const confirmPasswordFieldSchema = z.string({
  required_error: 'Confirm password is required'
});

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: z.string().email('Provide a valid email address'),
    password: passwordFieldSchema,
    confirmPassword: confirmPasswordFieldSchema
  })
  .strict()
  .superRefine((data, ctx) => {
    const issues = getPasswordStrengthIssues(data.password, {
      username: data.username,
      email: data.email
    });

    issues.forEach((message) =>
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: ['password']
      })
    );

    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
        path: ['confirmPassword']
      });
    }
  });

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
    currentPassword: passwordFieldSchema,
    newPassword: passwordFieldSchema,
    confirmNewPassword: z.string({
      required_error: 'Confirm new password is required'
    })
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.currentPassword === data.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'New password must differ from current password',
        path: ['newPassword']
      });
    }

    if (data.newPassword !== data.confirmNewPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'New password and confirmation must match',
        path: ['confirmNewPassword']
      });
    }
  });
