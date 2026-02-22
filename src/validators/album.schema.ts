// ---------------------------------------------------------------------------
// Album Validators (Zod Schemas)
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---- Create Album ----

export const createAlbumSchema = z.object({
  name: z
    .string()
    .min(1, 'Album name is required')
    .max(100, 'Album name must be at most 100 characters')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  coverMediaId: z
    .string()
    .uuid('Invalid media ID')
    .optional(),
});

export type CreateAlbumInput = z.infer<typeof createAlbumSchema>;

// ---- Update Album ----

export const updateAlbumSchema = z.object({
  name: z
    .string()
    .min(1, 'Album name must not be empty')
    .max(100, 'Album name must be at most 100 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .nullable()
    .optional(),
  coverMediaId: z
    .string()
    .uuid('Invalid media ID')
    .nullable()
    .optional(),
  sortOrder: z
    .number()
    .int()
    .min(0)
    .optional(),
});

export type UpdateAlbumInput = z.infer<typeof updateAlbumSchema>;

// ---- Add Media to Album ----

export const addMediaToAlbumSchema = z.object({
  mediaIds: z
    .array(z.string().uuid('Invalid media ID'))
    .min(1, 'At least one media ID is required')
    .max(200, 'Maximum 200 items per request'),
});

export type AddMediaToAlbumInput = z.infer<typeof addMediaToAlbumSchema>;

// ---- Remove Media from Album ----

export const removeMediaFromAlbumSchema = z.object({
  mediaIds: z
    .array(z.string().uuid('Invalid media ID'))
    .min(1, 'At least one media ID is required')
    .max(200, 'Maximum 200 items per request'),
});

export type RemoveMediaFromAlbumInput = z.infer<typeof removeMediaFromAlbumSchema>;

// ---- Reorder Album Media ----

export const reorderAlbumMediaSchema = z.object({
  mediaIds: z
    .array(z.string().uuid('Invalid media ID'))
    .min(1, 'At least one media ID is required'),
});

export type ReorderAlbumMediaInput = z.infer<typeof reorderAlbumMediaSchema>;
