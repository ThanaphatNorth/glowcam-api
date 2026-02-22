import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { authProviderEnum, subscriptionTierEnum } from "./enums";
import { subscriptions } from "./subscriptions";
import { media } from "./media";
import { albums } from "./albums";
import { supportTickets } from "./support";
import { analyticsEvents } from "./analytics";
import { devices } from "./devices";
import { refreshTokens } from "./refresh-tokens";
import { userContentDownloads } from "./content";

// ── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).unique(),
    phone: varchar("phone", { length: 20 }).unique(),
    passwordHash: varchar("password_hash", { length: 255 }),
    name: varchar("name", { length: 100 }).notNull(),
    avatarUrl: text("avatar_url"),
    subscriptionTier: subscriptionTierEnum("subscription_tier").default("free"),
    locale: varchar("locale", { length: 5 }).default("en"),
    authProvider: authProviderEnum("auth_provider").notNull(),
    authProviderId: varchar("auth_provider_id", { length: 255 }),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("users_email_idx").on(table.email),
    index("users_phone_idx").on(table.phone),
    index("users_auth_provider_idx").on(table.authProvider),
  ],
);

// ── Relations ───────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  media: many(media),
  albums: many(albums),
  supportTickets: many(supportTickets),
  analyticsEvents: many(analyticsEvents),
  devices: many(devices),
  refreshTokens: many(refreshTokens),
  contentDownloads: many(userContentDownloads),
}));
