// ---------------------------------------------------------------------------
// Media Validators (Zod Schemas)
// ---------------------------------------------------------------------------

import { z } from 'zod';

/** Allowed MIME types for media uploads. */
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'image/raw',
  'image/dng',
] as const;

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/webm',
] as const;

const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES] as const;

/** Max file sizes in bytes. */
const MAX_PHOTO_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

// ---- Presigned Upload ----

export const presignUploadSchema = z.object({
  fileName: z
    .string()
    .min(1, 'File name is required')
    .max(255, 'File name must be at most 255 characters')
    .regex(
      /^[\w\-. ]+$/,
      'File name contains invalid characters',
    ),
  mimeType: z.enum(ALLOWED_MIME_TYPES, {
    errorMap: () => ({ message: 'Unsupported file type' }),
  }),
  fileSize: z
    .number()
    .int()
    .positive('File size must be positive')
    .max(MAX_VIDEO_SIZE, 'File exceeds maximum size of 2 GB'),
}).refine(
  (data) => {
    if (ALLOWED_IMAGE_TYPES.includes(data.mimeType as typeof ALLOWED_IMAGE_TYPES[number])) {
      return data.fileSize <= MAX_PHOTO_SIZE;
    }
    return true;
  },
  {
    message: 'Photo file exceeds maximum size of 50 MB',
    path: ['fileSize'],
  },
);

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

// ---- Confirm Upload ----

export const confirmUploadSchema = z.object({
  width: z
    .number()
    .int()
    .positive()
    .max(8640)
    .optional(),
  height: z
    .number()
    .int()
    .positive()
    .max(8640)
    .optional(),
  duration: z
    .number()
    .positive()
    .max(7200) // 2 hours max
    .optional(),
});

export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

// ---- Media Query ----

export const mediaQuerySchema = z.object({
  page: z
    .number()
    .int()
    .positive()
    .default(1),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(20),
  type: z.enum(['photo', 'video']).optional(),
  status: z
    .enum(['pending_upload', 'processing', 'ready', 'failed', 'deleted'])
    .optional(),
  isFavorite: z.boolean().optional(),
  albumId: z.string().uuid().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  search: z.string().max(200).optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'fileSize'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type MediaQueryInput = z.infer<typeof mediaQuerySchema>;

// ---- Update Media ----

export const updateMediaSchema = z.object({
  isFavorite: z.boolean().optional(),
  tags: z
    .array(z.string().min(1).max(50))
    .max(20, 'Maximum 20 tags allowed')
    .optional(),
  metadata: z
    .object({
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
    })
    .optional(),
});

export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;

// ---- Batch Delete ----

export const batchDeleteMediaSchema = z.object({
  mediaIds: z
    .array(z.string().uuid())
    .min(1, 'At least one media ID is required')
    .max(100, 'Maximum 100 items per batch'),
});

export type BatchDeleteMediaInput = z.infer<typeof batchDeleteMediaSchema>;

// ---- Exported constants ----

export {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_MIME_TYPES,
  MAX_PHOTO_SIZE,
  MAX_VIDEO_SIZE,
};
