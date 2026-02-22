import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { contentTypeEnum, subscriptionTierEnum } from "./enums";
import { users } from "./users";

// ── Content ─────────────────────────────────────────────────────────────────
export const content = pgTable(
  "content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: contentTypeEnum("type").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    nameTh: varchar("name_th", { length: 100 }),
    description: text("description"),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    tierRequired: subscriptionTierEnum("tier_required").default("free"),
    category: varchar("category", { length: 50 }),
    sortOrder: integer("sort_order").default(0),
    isActive: boolean("is_active").default(true),
    downloadCount: integer("download_count").default(0),
    fileSize: integer("file_size"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("content_type_idx").on(table.type),
    index("content_tier_required_idx").on(table.tierRequired),
    index("content_category_idx").on(table.category),
    index("content_is_active_idx").on(table.isActive),
    index("content_sort_order_idx").on(table.sortOrder),
  ],
);

// ── User Content Downloads (Junction Table) ─────────────────────────────────
export const userContentDownloads = pgTable(
  "user_content_downloads",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentId: uuid("content_id")
      .notNull()
      .references(() => content.id, { onDelete: "cascade" }),
    downloadedAt: timestamp("downloaded_at", {
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.contentId] }),
  ],
);

// ── Relations ───────────────────────────────────────────────────────────────
export const contentRelations = relations(content, ({ many }) => ({
  downloads: many(userContentDownloads),
}));

export const userContentDownloadsRelations = relations(
  userContentDownloads,
  ({ one }) => ({
    user: one(users, {
      fields: [userContentDownloads.userId],
      references: [users.id],
    }),
    content: one(content, {
      fields: [userContentDownloads.contentId],
      references: [content.id],
    }),
  }),
);
