import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users";
import { media } from "./media";

// ── Albums ──────────────────────────────────────────────────────────────────
export const albums = pgTable(
  "albums",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    coverMediaId: uuid("cover_media_id").references(() => media.id),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("albums_user_id_idx").on(table.userId),
  ],
);

// ── Album Media (Junction Table) ────────────────────────────────────────────
export const albumMedia = pgTable(
  "album_media",
  {
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.albumId, table.mediaId] }),
  ],
);

// ── Relations ───────────────────────────────────────────────────────────────
export const albumsRelations = relations(albums, ({ one, many }) => ({
  user: one(users, {
    fields: [albums.userId],
    references: [users.id],
  }),
  coverMedia: one(media, {
    fields: [albums.coverMediaId],
    references: [media.id],
  }),
  albumMedia: many(albumMedia),
}));

export const albumMediaRelations = relations(albumMedia, ({ one }) => ({
  album: one(albums, {
    fields: [albumMedia.albumId],
    references: [albums.id],
  }),
  media: one(media, {
    fields: [albumMedia.mediaId],
    references: [media.id],
  }),
}));
