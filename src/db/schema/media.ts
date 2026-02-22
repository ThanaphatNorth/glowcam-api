import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { mediaStatusEnum, mediaTypeEnum } from "./enums";
import { users } from "./users";
import { albumMedia } from "./albums";

// ── Media ───────────────────────────────────────────────────────────────────
export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: mediaTypeEnum("type").notNull(),
    status: mediaStatusEnum("status").default("uploading"),
    originalUrl: text("original_url").notNull(),
    processedUrl: text("processed_url"),
    thumbnailUrl: text("thumbnail_url"),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    mimeType: varchar("mime_type", { length: 50 }).notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    metadata: jsonb("metadata").default({}),
    isFavorite: boolean("is_favorite").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("media_user_id_idx").on(table.userId),
    index("media_type_idx").on(table.type),
    index("media_created_at_idx").on(table.createdAt),
    index("media_is_favorite_idx").on(table.isFavorite),
  ],
);

// ── Relations ───────────────────────────────────────────────────────────────
export const mediaRelations = relations(media, ({ one, many }) => ({
  user: one(users, {
    fields: [media.userId],
    references: [users.id],
  }),
  albumMedia: many(albumMedia),
}));
