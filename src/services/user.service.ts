/**
 * User Service
 *
 * Handles user profile management, subscription queries,
 * account deactivation with grace period, and GDPR data export.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../db/client';
import { users, subscriptions, media, albums, supportTickets } from '../db/schema';

// ── Types ───────────────────────────────────────────────────────────────────

export interface UpdateUserData {
  name?: string;
  avatarUrl?: string | null;
  locale?: string;
}

export interface UserExportData {
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    name: string;
    avatarUrl: string | null;
    subscriptionTier: string | null;
    locale: string | null;
    authProvider: string;
    createdAt: Date | null;
  };
  subscriptions: (typeof subscriptions.$inferSelect)[];
  mediaCount: number;
  albumCount: number;
  tickets: {
    id: string;
    subject: string;
    status: string | null;
    createdAt: Date | null;
  }[];
}

// ── Public Functions ────────────────────────────────────────────────────────

/**
 * Get a user by ID with sensitive fields stripped.
 */
export async function getUserById(
  userId: string,
): Promise<Omit<typeof users.$inferSelect, 'passwordHash'>> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  // Strip passwordHash before returning
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * Update user profile fields.
 */
export async function updateUser(
  userId: string,
  data: UpdateUserData,
): Promise<Omit<typeof users.$inferSelect, 'passwordHash'>> {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
  if (data.locale !== undefined) updateData.locale = data.locale;

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, userId))
    .returning();

  if (!updated) {
    throw new Error('User not found');
  }

  const { passwordHash, ...safeUser } = updated;
  return safeUser;
}

/**
 * Deactivate a user account (soft delete with 30-day grace period).
 * The account can be reactivated within the grace period.
 */
export async function deleteUser(
  userId: string,
): Promise<{ success: boolean; reactivateBy: Date }> {
  const [updated] = await db
    .update(users)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(users.id, userId),
        eq(users.isActive, true),
      ),
    )
    .returning({ id: users.id });

  if (!updated) {
    throw new Error('User not found or already deactivated');
  }

  const reactivateBy = new Date();
  reactivateBy.setDate(reactivateBy.getDate() + 30);

  return {
    success: true,
    reactivateBy,
  };
}

/**
 * Get the active subscription for a user.
 */
export async function getUserSubscription(
  userId: string,
): Promise<typeof subscriptions.$inferSelect | null> {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, 'active'),
      ),
    )
    .limit(1);

  return subscription ?? null;
}

/**
 * Export all user data for GDPR compliance.
 * Returns a structured object containing all data associated with the user.
 */
export async function exportUserData(
  userId: string,
): Promise<UserExportData> {
  // Fetch all data in parallel
  const [
    [user],
    userSubscriptions,
    [mediaCount],
    [albumCount],
    userTickets,
  ] = await Promise.all([
    db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId)),
    db
      .select({
        count: eq(media.userId, userId),
      })
      .from(media)
      .where(eq(media.userId, userId))
      .then((rows) => [{ count: rows.length }]),
    db
      .select({
        count: eq(albums.userId, userId),
      })
      .from(albums)
      .where(eq(albums.userId, userId))
      .then((rows) => [{ count: rows.length }]),
    db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        status: supportTickets.status,
        createdAt: supportTickets.createdAt,
      })
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId)),
  ]);

  if (!user) {
    throw new Error('User not found');
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      avatarUrl: user.avatarUrl,
      subscriptionTier: user.subscriptionTier,
      locale: user.locale,
      authProvider: user.authProvider,
      createdAt: user.createdAt,
    },
    subscriptions: userSubscriptions,
    mediaCount: mediaCount?.count ?? 0,
    albumCount: albumCount?.count ?? 0,
    tickets: userTickets,
  };
}
