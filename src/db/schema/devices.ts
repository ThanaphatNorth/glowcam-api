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

import { platformEnum } from "./enums";
import { users } from "./users";
import { refreshTokens } from "./refresh-tokens";

// ── Devices ─────────────────────────────────────────────────────────────────
export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    pushToken: text("push_token").notNull(),
    deviceModel: varchar("device_model", { length: 100 }),
    osVersion: varchar("os_version", { length: 20 }),
    appVersion: varchar("app_version", { length: 20 }),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("devices_user_id_idx").on(table.userId),
    index("devices_platform_idx").on(table.platform),
    index("devices_is_active_idx").on(table.isActive),
  ],
);

// ── Relations ───────────────────────────────────────────────────────────────
export const devicesRelations = relations(devices, ({ one, many }) => ({
  user: one(users, {
    fields: [devices.userId],
    references: [users.id],
  }),
  refreshTokens: many(refreshTokens),
}));
