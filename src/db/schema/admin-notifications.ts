import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { adminUsers } from "./admin";

// ── Enum ────────────────────────────────────────────────────────────────────

export const notificationTypeEnum = pgEnum("notification_type", [
  "new_ticket",
  "ticket_reply",
  "new_user",
  "subscription_change",
  "system_alert",
  "flag_change",
  "content_update",
]);

// ── Admin Notifications ─────────────────────────────────────────────────────

export const adminNotifications = pgTable(
  "admin_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientId: uuid("recipient_id").references(() => adminUsers.id, {
      onDelete: "cascade",
    }),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    link: varchar("link", { length: 500 }),
    metadata: jsonb("metadata").default({}),
    isRead: boolean("is_read").default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("admin_notifications_recipient_id_idx").on(table.recipientId),
    index("admin_notifications_is_read_idx").on(table.isRead),
    index("admin_notifications_created_at_idx").on(table.createdAt),
    index("admin_notifications_type_idx").on(table.type),
  ],
);

// ── Relations ───────────────────────────────────────────────────────────────

export const adminNotificationsRelations = relations(
  adminNotifications,
  ({ one }) => ({
    recipient: one(adminUsers, {
      fields: [adminNotifications.recipientId],
      references: [adminUsers.id],
    }),
  }),
);
