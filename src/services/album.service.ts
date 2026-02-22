/**
 * Album Service
 *
 * Handles album CRUD with tier-based limits, media association,
 * and ownership verification.
 */

import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { albums, albumMedia, media } from '../db/schema';

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreateAlbumInput {
  userId: string;
  name: string;
  description?: string;
  tier: string;
}

export interface ListAlbumsInput {
  userId: string;
  page?: number;
  limit?: number;
}

export interface GetAlbumInput {
  albumId: string;
  userId: string;
  includeMedia?: boolean;
}

export interface UpdateAlbumInput {
  albumId: string;
  userId: string;
  name?: string;
  description?: string;
  coverMediaId?: string | null;
  sortOrder?: number;
}

export interface AddMediaToAlbumInput {
  albumId: string;
  userId: string;
  mediaIds: string[];
}

export interface RemoveMediaFromAlbumInput {
  albumId: string;
  userId: string;
  mediaIds: string[];
}

// ── Constants ───────────────────────────────────────────────────────────────

const ALBUM_LIMITS: Record<string, number> = {
  free: 5,
  premium: 50,
  pro: 200,
  enterprise: Infinity,
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ── Public Functions ────────────────────────────────────────────────────────

/**
 * Create a new album. Checks tier-based album limits before creation.
 */
export async function createAlbum(
  input: CreateAlbumInput,
): Promise<typeof albums.$inferSelect> {
  const { userId, name, description, tier } = input;

  // Check album limit for this tier
  const maxAlbums = ALBUM_LIMITS[tier] ?? ALBUM_LIMITS.free!;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(albums)
    .where(eq(albums.userId, userId));

  const currentCount = countResult?.count ?? 0;

  if (currentCount >= maxAlbums) {
    throw new Error(
      `Album limit reached for ${tier} tier (${maxAlbums} albums). Upgrade your plan to create more albums.`,
    );
  }

  const [album] = await db
    .insert(albums)
    .values({
      userId,
      name,
      description: description ?? null,
      sortOrder: currentCount, // auto-increment sort order
    })
    .returning();

  if (!album) {
    throw new Error('Failed to create album');
  }

  return album;
}

/**
 * List albums for a user with media count included.
 */
export async function listAlbums(
  input: ListAlbumsInput,
): Promise<{
  items: (typeof albums.$inferSelect & { mediaCount: number })[];
  total: number;
  page: number;
  limit: number;
}> {
  const {
    userId,
    page = 1,
    limit: rawLimit = DEFAULT_PAGE_SIZE,
  } = input;

  const limit = Math.min(Math.max(rawLimit, 1), MAX_PAGE_SIZE);
  const offset = (Math.max(page, 1) - 1) * limit;

  const whereClause = eq(albums.userId, userId);

  const [countResult, items] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(albums)
      .where(whereClause),
    db
      .select({
        id: albums.id,
        userId: albums.userId,
        name: albums.name,
        description: albums.description,
        coverMediaId: albums.coverMediaId,
        sortOrder: albums.sortOrder,
        createdAt: albums.createdAt,
        updatedAt: albums.updatedAt,
        mediaCount: sql<number>`(
          SELECT count(*)::int FROM album_media
          WHERE album_media.album_id = ${albums.id}
        )`,
      })
      .from(albums)
      .where(whereClause)
      .orderBy(desc(albums.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      mediaCount: item.mediaCount ?? 0,
    })),
    total: countResult[0]?.count ?? 0,
    page,
    limit,
  };
}

/**
 * Get a single album by ID with optional media inclusion.
 */
export async function getAlbum(
  input: GetAlbumInput,
): Promise<{
  album: typeof albums.$inferSelect & { mediaCount: number };
  media?: (typeof media.$inferSelect)[];
}> {
  const { albumId, userId, includeMedia = false } = input;

  const [album] = await db
    .select({
      id: albums.id,
      userId: albums.userId,
      name: albums.name,
      description: albums.description,
      coverMediaId: albums.coverMediaId,
      sortOrder: albums.sortOrder,
      createdAt: albums.createdAt,
      updatedAt: albums.updatedAt,
      mediaCount: sql<number>`(
        SELECT count(*)::int FROM album_media
        WHERE album_media.album_id = ${albums.id}
      )`,
    })
    .from(albums)
    .where(
      and(
        eq(albums.id, albumId),
        eq(albums.userId, userId),
      ),
    )
    .limit(1);

  if (!album) {
    throw new Error('Album not found');
  }

  const result: {
    album: typeof album & { mediaCount: number };
    media?: (typeof media.$inferSelect)[];
  } = {
    album: { ...album, mediaCount: album.mediaCount ?? 0 },
  };

  if (includeMedia) {
    const albumMediaItems = await db
      .select({
        media: media,
      })
      .from(albumMedia)
      .innerJoin(media, eq(albumMedia.mediaId, media.id))
      .where(eq(albumMedia.albumId, albumId))
      .orderBy(albumMedia.sortOrder);

    result.media = albumMediaItems.map((row) => row.media);
  }

  return result;
}

/**
 * Update album properties.
 */
export async function updateAlbum(
  input: UpdateAlbumInput,
): Promise<typeof albums.$inferSelect> {
  const { albumId, userId, name, description, coverMediaId, sortOrder } = input;

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (coverMediaId !== undefined) updateData.coverMediaId = coverMediaId;
  if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

  const [updated] = await db
    .update(albums)
    .set(updateData)
    .where(
      and(
        eq(albums.id, albumId),
        eq(albums.userId, userId),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error('Album not found');
  }

  return updated;
}

/**
 * Delete an album and its media associations.
 * The media files themselves are not deleted.
 */
export async function deleteAlbum(
  albumId: string,
  userId: string,
): Promise<{ success: boolean }> {
  const [deleted] = await db
    .delete(albums)
    .where(
      and(
        eq(albums.id, albumId),
        eq(albums.userId, userId),
      ),
    )
    .returning({ id: albums.id });

  if (!deleted) {
    throw new Error('Album not found');
  }

  return { success: true };
}

/**
 * Add multiple media items to an album.
 * Verifies that the user owns both the album and the media.
 */
export async function addMediaToAlbum(
  input: AddMediaToAlbumInput,
): Promise<{ added: number }> {
  const { albumId, userId, mediaIds } = input;

  if (mediaIds.length === 0) {
    return { added: 0 };
  }

  // Verify album ownership
  const [album] = await db
    .select({ id: albums.id })
    .from(albums)
    .where(
      and(
        eq(albums.id, albumId),
        eq(albums.userId, userId),
      ),
    )
    .limit(1);

  if (!album) {
    throw new Error('Album not found');
  }

  // Verify media ownership - only add media that belongs to the user
  const ownedMedia = await db
    .select({ id: media.id })
    .from(media)
    .where(
      and(
        inArray(media.id, mediaIds),
        eq(media.userId, userId),
      ),
    );

  const ownedMediaIds = ownedMedia.map((m) => m.id);

  if (ownedMediaIds.length === 0) {
    throw new Error('No valid media items found');
  }

  // Get max sort order
  const [maxSort] = await db
    .select({ maxOrder: sql<number>`coalesce(max(sort_order), -1)::int` })
    .from(albumMedia)
    .where(eq(albumMedia.albumId, albumId));

  let nextOrder = (maxSort?.maxOrder ?? -1) + 1;

  // Insert media associations (skip duplicates)
  const values = ownedMediaIds.map((mediaId) => ({
    albumId,
    mediaId,
    sortOrder: nextOrder++,
  }));

  const result = await db
    .insert(albumMedia)
    .values(values)
    .onConflictDoNothing()
    .returning();

  return { added: result.length };
}

/**
 * Remove media items from an album.
 * Verifies album ownership. Does not delete the media files.
 */
export async function removeMediaFromAlbum(
  input: RemoveMediaFromAlbumInput,
): Promise<{ removed: number }> {
  const { albumId, userId, mediaIds } = input;

  if (mediaIds.length === 0) {
    return { removed: 0 };
  }

  // Verify album ownership
  const [album] = await db
    .select({ id: albums.id })
    .from(albums)
    .where(
      and(
        eq(albums.id, albumId),
        eq(albums.userId, userId),
      ),
    )
    .limit(1);

  if (!album) {
    throw new Error('Album not found');
  }

  const deleted = await db
    .delete(albumMedia)
    .where(
      and(
        eq(albumMedia.albumId, albumId),
        inArray(albumMedia.mediaId, mediaIds),
      ),
    )
    .returning();

  return { removed: deleted.length };
}
