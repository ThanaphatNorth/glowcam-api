import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { adminRoleEnum } from "./enums";
import { featureFlags } from "./feature-flags";
import { supportTickets } from "./support";
import { appSettings } from "./settings";

// ── Admin Users ─────────────────────────────────────────────────────────────
export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).unique().notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    role: adminRoleEnum("role").notNull(),
    permissions: jsonb("permissions").default([]),
    isActive: boolean("is_active").default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("admin_users_email_idx").on(table.email),
    index("admin_users_role_idx").on(table.role),
  ],
);

// ── Relations ───────────────────────────────────────────────────────────────
export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  assignedTickets: many(supportTickets),
  createdFeatureFlags: many(featureFlags),
  updatedSettings: many(appSettings),
}));
