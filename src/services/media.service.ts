/**
 * Media Service
 *
 * Handles media CRUD operations with presigned S3 uploads,
 * pagination, filtering, and metadata management.
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { media } from '../db/schema';
import { generatePresignedUploadUrl, buildMediaKey } from '../lib/storage';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PresignedUploadInput {
  userId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  type: 'photo' | 'video';
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface ConfirmUploadInput {
  mediaId: string;
  userId: string;
}

export interface ListMediaInput {
  userId: string;
  page?: number;
  limit?: number;
  type?: 'photo' | 'video';
  isFavorite?: boolean;
}

export interface UpdateMediaInput {
  mediaId: string;
  userId: string;
  isFavorite?: boolean;
  metadata?: Record<string, unknown>;
}

// ── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildOriginalUrl(objectKey: string): string {
  const publicUrl = process.env.S3_PUBLIC_URL;
  if (publicUrl) {
    return `${publicUrl}/${objectKey}`;
  }
  const endpoint = process.env.S3_ENDPOINT ?? '';
  const bucket = process.env.S3_BUCKET ?? '';
  return `${endpoint}/${bucket}/${objectKey}`;
}

// ── Public Functions ────────────────────────────────────────────────────────

/**
 * Create a presigned upload URL and insert an initial media record.
 * The media starts in 'uploading' status.
 */
export async function createPresignedUpload(
  input: PresignedUploadInput,
): Promise<{
  mediaId: string;
  uploadUrl: string;
  objectKey: string;
}> {
  const { userId, filename, mimeType, fileSize, type, width, height, durationMs } = input;

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(
      `Unsupported file type: ${mimeType}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
    );
  }

  // Validate file size
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(
      `File size ${fileSize} bytes exceeds maximum of ${MAX_FILE_SIZE} bytes (500 MB)`,
    );
  }

  if (fileSize <= 0) {
    throw new Error('File size must be greater than 0');
  }

  // Build the S3 object key
  const objectKey = buildMediaKey(userId, filename);

  // Generate presigned upload URL
  const { url: uploadUrl } = await generatePresignedUploadUrl(
    objectKey,
    mimeType,
    fileSize,
    3600, // 1 hour expiry
  );

  // Insert the media record with uploading status
  const originalUrl = buildOriginalUrl(objectKey);

  const [record] = await db
    .insert(media)
    .values({
      userId,
      type,
      status: 'uploading',
      originalUrl,
      fileSize,
      mimeType,
      width: width ?? null,
      height: height ?? null,
      durationMs: durationMs ?? null,
      metadata: {},
    })
    .returning();

  if (!record) {
    throw new Error('Failed to create media record');
  }

  return {
    mediaId: record.id,
    uploadUrl,
    objectKey,
  };
}

/**
 * Confirm that a file upload has completed.
 * Transitions the media status to 'processing'.
 */
export async function confirmUpload(
  input: ConfirmUploadInput,
): Promise<typeof media.$inferSelect> {
  const { mediaId, userId } = input;

  const [updated] = await db
    .update(media)
    .set({
      status: 'processing',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(media.id, mediaId),
        eq(media.userId, userId),
        eq(media.status, 'uploading'),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error('Media not found, not owned by user, or not in uploading status');
  }

  return updated;
}

/**
 * List media for a user with pagination and optional filters.
 */
export async function listMedia(
  input: ListMediaInput,
): Promise<{
  items: (typeof media.$inferSelect)[];
  total: number;
  page: number;
  limit: number;
}> {
  const {
    userId,
    page = 1,
    limit: rawLimit = DEFAULT_PAGE_SIZE,
    type,
    isFavorite,
  } = input;

  const limit = Math.min(Math.max(rawLimit, 1), MAX_PAGE_SIZE);
  const offset = (Math.max(page, 1) - 1) * limit;

  // Build conditions
  const conditions = [eq(media.userId, userId)];

  if (type) {
    conditions.push(eq(media.type, type));
  }

  if (isFavorite !== undefined) {
    conditions.push(eq(media.isFavorite, isFavorite));
  }

  const whereClause = and(...conditions);

  // Execute count and data queries in parallel
  const [countResult, items] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(media)
      .where(whereClause),
    db
      .select()
      .from(media)
      .where(whereClause)
      .orderBy(desc(media.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  return {
    items,
    total: countResult[0]?.count ?? 0,
    page,
    limit,
  };
}

/**
 * Get a single media item by ID and verify ownership.
 */
export async function getMedia(
  mediaId: string,
  userId: string,
): Promise<typeof media.$inferSelect> {
  const [item] = await db
    .select()
    .from(media)
    .where(
      and(
        eq(media.id, mediaId),
        eq(media.userId, userId),
      ),
    )
    .limit(1);

  if (!item) {
    throw new Error('Media not found');
  }

  return item;
}

/**
 * Update media metadata (favorite status, custom metadata).
 */
export async function updateMedia(
  input: UpdateMediaInput,
): Promise<typeof media.$inferSelect> {
  const { mediaId, userId, isFavorite, metadata: newMetadata } = input;

  // Fetch existing to merge metadata
  const [existing] = await db
    .select()
    .from(media)
    .where(
      and(
        eq(media.id, mediaId),
        eq(media.userId, userId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new Error('Media not found');
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (isFavorite !== undefined) {
    updateData.isFavorite = isFavorite;
  }

  if (newMetadata) {
    // Merge with existing metadata
    const existingMeta = (existing.metadata ?? {}) as Record<string, unknown>;
    updateData.metadata = { ...existingMeta, ...newMetadata };
  }

  const [updated] = await db
    .update(media)
    .set(updateData)
    .where(
      and(
        eq(media.id, mediaId),
        eq(media.userId, userId),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error('Failed to update media');
  }

  return updated;
}

/**
 * Delete a media item by ID. Verifies ownership before deleting.
 */
export async function deleteMedia(
  mediaId: string,
  userId: string,
): Promise<{ success: boolean }> {
  const [deleted] = await db
    .delete(media)
    .where(
      and(
        eq(media.id, mediaId),
        eq(media.userId, userId),
      ),
    )
    .returning({ id: media.id });

  if (!deleted) {
    throw new Error('Media not found');
  }

  // TODO: Queue S3 object deletion via background job

  return { success: true };
}
