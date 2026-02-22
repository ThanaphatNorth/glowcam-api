// ---------------------------------------------------------------------------
// User Validators (Zod Schemas)
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---- Update User Profile ----

export const updateUserSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim()
    .optional(),
  bio: z
    .string()
    .max(500, 'Bio must be at most 500 characters')
    .nullable()
    .optional(),
  website: z
    .string()
    .url('Please enter a valid URL')
    .max(255)
    .nullable()
    .optional(),
  locale: z
    .string()
    .min(2)
    .max(10)
    .optional(),
  avatarUrl: z
    .string()
    .url('Invalid avatar URL')
    .nullable()
    .optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ---- Update User Preferences ----

export const updatePreferencesSchema = z.object({
  locale: z.string().min(2).max(10).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  cameraDefaultFlash: z.enum(['off', 'on', 'auto']).optional(),
  cameraDefaultGrid: z.boolean().optional(),
  cameraDefaultTimer: z.union([
    z.literal(0),
    z.literal(3),
    z.literal(5),
    z.literal(10),
  ]).optional(),
  cameraDefaultRatio: z.enum(['4:3', '16:9', '1:1', '3:2']).optional(),
  saveOriginal: z.boolean().optional(),
  autoEnhance: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
  emailMarketingEnabled: z.boolean().optional(),
  pushNotificationsEnabled: z.boolean().optional(),
  hapticFeedbackEnabled: z.boolean().optional(),
  highQualityUpload: z.boolean().optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

// ---- Delete Account ----

export const deleteAccountSchema = z.object({
  confirmPassword: z
    .string()
    .min(1, 'Please enter your password to confirm account deletion'),
  reason: z
    .string()
    .max(1000, 'Reason must be at most 1000 characters')
    .optional(),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

// ---- Update Avatar ----

export const updateAvatarSchema = z.object({
  avatarUrl: z.string().url('Invalid avatar URL'),
});

export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>;
