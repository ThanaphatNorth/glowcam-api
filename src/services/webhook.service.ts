/**
 * Webhook Service
 *
 * Handles RevenueCat subscription webhook events including
 * signature verification, tier mapping, and subscription management.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, subscriptions } from '../db/schema';

// ── Types ───────────────────────────────────────────────────────────────────

export interface WebhookEvent {
  type: string;
  app_user_id: string;
  product_id?: string;
  expiration_at_ms?: number;
}

export interface WebhookResult {
  handled: boolean;
  userId?: string;
  tier?: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const EVENT_TO_TIER: Record<string, string> = {
  INITIAL_PURCHASE: 'premium',
  RENEWAL: 'premium',
  PRODUCT_CHANGE: 'premium',
  CANCELLATION: 'free',
  EXPIRATION: 'free',
};

// ── Public Functions ────────────────────────────────────────────────────────

/**
 * Verify the webhook signature using HMAC SHA-256.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}

/**
 * Handle a RevenueCat webhook event.
 *
 * Processes subscription state changes:
 * - INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE: upgrades the user's tier
 * - CANCELLATION, EXPIRATION: downgrades to free tier
 *
 * The tier is determined by product_id if available, otherwise defaults
 * to the event type mapping.
 */
export async function handleWebhookEvent(
  event: WebhookEvent,
): Promise<WebhookResult> {
  const userId = event.app_user_id;
  const newTier = EVENT_TO_TIER[event.type];

  if (!newTier) {
    console.log(`[Webhook] Unhandled event type: ${event.type}`);
    return { handled: false };
  }

  // Determine tier from product_id if available
  let tier = newTier;
  if (event.product_id) {
    if (event.product_id.includes('pro')) tier = 'pro';
    else if (event.product_id.includes('enterprise')) tier = 'enterprise';
    else if (event.product_id.includes('premium')) tier = 'premium';
  }

  // Cancellation and expiration always revert to free
  if (event.type === 'CANCELLATION' || event.type === 'EXPIRATION') {
    tier = 'free';
  }

  // Update user's subscription tier
  await db
    .update(users)
    .set({
      subscriptionTier: tier as 'free' | 'premium' | 'pro' | 'enterprise',
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Update or create subscription record for active subscriptions
  if (event.type !== 'CANCELLATION' && event.type !== 'EXPIRATION') {
    await db
      .insert(subscriptions)
      .values({
        userId,
        tier: tier as 'free' | 'premium' | 'pro' | 'enterprise',
        status: 'active',
        platform: 'ios',
        startsAt: new Date(),
        expiresAt: event.expiration_at_ms
          ? new Date(event.expiration_at_ms)
          : null,
      })
      .onConflictDoNothing();
  }

  return { handled: true, userId, tier };
}
