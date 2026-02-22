import { relations } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { adminUsers } from "./admin";

// ── App Settings ────────────────────────────────────────────────────────────
export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedBy: uuid("updated_by").references(() => adminUsers.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ── Relations ───────────────────────────────────────────────────────────────
export const appSettingsRelations = relations(appSettings, ({ one }) => ({
  updatedByAdmin: one(adminUsers, {
    fields: [appSettings.updatedBy],
    references: [adminUsers.id],
  }),
}));
