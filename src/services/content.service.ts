/**
 * Content Service
 *
 * Handles content distribution with tier-based access control,
 * download tracking, and presigned URL generation.
 */

import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { content, userContentDownloads } from '../db/schema';
import { generatePresignedDownloadUrl } from '../lib/storage';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ListContentInput {
  tier: string;
  type?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export interface DownloadContentResult {
  downloadUrl: string;
  contentId: string;
  name: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const TIER_HIERARCHY: Record<string, string[]> = {
  free: ['free'],
  premium: ['free', 'premium'],
  pro: ['free', 'premium', 'pro'],
  enterprise: ['free', 'premium', 'pro', 'enterprise'],
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ── Public Functions ────────────────────────────────────────────────────────

/**
 * List available content filtered by the user's subscription tier.
 * Higher tiers have access to content from lower tiers as well.
 */
export async function listContent(
  input: ListContentInput,
): Promise<{
  items: (typeof content.$inferSelect)[];
  total: number;
  page: number;
  limit: number;
}> {
  const {
    tier,
    type,
    category,
    page = 1,
    limit: rawLimit = DEFAULT_PAGE_SIZE,
  } = input;

  const limit = Math.min(Math.max(rawLimit, 1), MAX_PAGE_SIZE);
  const offset = (Math.max(page, 1) - 1) * limit;

  // Get accessible tiers for the user's subscription level
  const accessibleTiers = TIER_HIERARCHY[tier] ?? TIER_HIERARCHY.free!;

  // Build conditions
  const conditions = [
    eq(content.isActive, true),
    inArray(content.tierRequired, accessibleTiers as ('free' | 'premium' | 'pro' | 'enterprise')[]),
  ];

  if (type) {
    conditions.push(eq(content.type, type as any));
  }

  if (category) {
    conditions.push(eq(content.category, category));
  }

  const whereClause = and(...conditions);

  const [countResult, items] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(content)
      .where(whereClause),
    db
      .select()
      .from(content)
      .where(whereClause)
      .orderBy(content.sortOrder, desc(content.createdAt))
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
 * Get a single content item by ID.
 * Verifies that the user's tier has access.
 */
export async function getContent(
  contentId: string,
  tier: string,
): Promise<typeof content.$inferSelect> {
  const [item] = await db
    .select()
    .from(content)
    .where(
      and(
        eq(content.id, contentId),
        eq(content.isActive, true),
      ),
    )
    .limit(1);

  if (!item) {
    throw new Error('Content not found');
  }

  // Verify tier access
  const accessibleTiers = TIER_HIERARCHY[tier] ?? TIER_HIERARCHY.free!;
  if (item.tierRequired && !accessibleTiers.includes(item.tierRequired)) {
    throw new Error(
      `This content requires ${item.tierRequired} tier or higher. Please upgrade your plan.`,
    );
  }

  return item;
}

/**
 * Download content: records the download, increments the counter,
 * and returns a presigned download URL.
 */
export async function downloadContent(
  contentId: string,
  userId: string,
  tier: string,
): Promise<DownloadContentResult> {
  // Get and verify content access
  const item = await getContent(contentId, tier);

  // Extract the S3 key from the content URL
  const objectKey = item.url;

  // Record the download (upsert - user might re-download)
  await db
    .insert(userContentDownloads)
    .values({
      userId,
      contentId,
      downloadedAt: new Date(),
    })
    .onConflictDoNothing();

  // Increment download count
  await db
    .update(content)
    .set({
      downloadCount: sql`${content.downloadCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(content.id, contentId));

  // Generate presigned download URL
  const downloadUrl = await generatePresignedDownloadUrl(objectKey, 3600);

  return {
    downloadUrl,
    contentId: item.id,
    name: item.name,
  };
}
