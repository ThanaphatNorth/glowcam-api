import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { platformEnum } from "./enums";
import { users } from "./users";

// ── Analytics Events ────────────────────────────────────────────────────────
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    deviceId: varchar("device_id", { length: 255 }),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    properties: jsonb("properties").default({}),
    sessionId: varchar("session_id", { length: 100 }),
    platform: platformEnum("platform"),
    appVersion: varchar("app_version", { length: 20 }),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("analytics_events_user_id_idx").on(table.userId),
    index("analytics_events_event_type_idx").on(table.eventType),
    index("analytics_events_timestamp_idx").on(table.timestamp),
    index("analytics_events_session_id_idx").on(table.sessionId),
  ],
);

// ── Relations ───────────────────────────────────────────────────────────────
export const analyticsEventsRelations = relations(
  analyticsEvents,
  ({ one }) => ({
    user: one(users, {
      fields: [analyticsEvents.userId],
      references: [users.id],
    }),
  }),
);
