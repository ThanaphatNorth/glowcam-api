import { pgEnum } from "drizzle-orm/pg-core";

// ── Subscription ────────────────────────────────────────────────────────────
export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free",
  "premium",
  "pro",
  "enterprise",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "expired",
  "cancelled",
  "grace_period",
]);

// ── Platform ────────────────────────────────────────────────────────────────
export const platformEnum = pgEnum("platform", ["ios", "android", "web"]);

// ── Media ───────────────────────────────────────────────────────────────────
export const mediaTypeEnum = pgEnum("media_type", ["photo", "video"]);

export const mediaStatusEnum = pgEnum("media_status", [
  "uploading",
  "processing",
  "ready",
  "failed",
]);

// ── Auth ────────────────────────────────────────────────────────────────────
export const authProviderEnum = pgEnum("auth_provider", [
  "email",
  "apple",
  "google",
  "phone",
]);

// ── Support ─────────────────────────────────────────────────────────────────
export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "waiting_on_user",
  "resolved",
  "closed",
]);

export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const senderTypeEnum = pgEnum("sender_type", [
  "user",
  "admin",
  "system",
]);

// ── Admin ───────────────────────────────────────────────────────────────────
export const adminRoleEnum = pgEnum("admin_role", [
  "super_admin",
  "admin",
  "support",
  "analyst",
]);

// ── Feature Flags ───────────────────────────────────────────────────────────
export const flagTypeEnum = pgEnum("flag_type", [
  "boolean",
  "string",
  "number",
  "json",
]);

// ── Content ─────────────────────────────────────────────────────────────────
export const contentTypeEnum = pgEnum("content_type", [
  "filter",
  "sticker",
  "preset",
  "frame",
  "font",
]);
