import { relations } from "drizzle-orm";
import {
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

import { flagTypeEnum } from "./enums";
import { adminUsers } from "./admin";

// ── Feature Flags ───────────────────────────────────────────────────────────
export const featureFlags = pgTable(
  "feature_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 100 }).unique().notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    type: flagTypeEnum("type").default("boolean"),
    defaultValue: jsonb("default_value").notNull(),
    enabled: boolean("enabled").default(false),
    createdBy: uuid("created_by").references(() => adminUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("feature_flags_key_idx").on(table.key),
    index("feature_flags_enabled_idx").on(table.enabled),
  ],
);

// ── Feature Flag Rules ──────────────────────────────────────────────────────
export const featureFlagRules = pgTable(
  "feature_flag_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flagId: uuid("flag_id")
      .notNull()
      .references(() => featureFlags.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull(),
    conditions: jsonb("conditions").notNull(),
    value: jsonb("value").notNull(),
    rolloutPercentage: integer("rollout_percentage"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("feature_flag_rules_flag_id_idx").on(table.flagId),
    index("feature_flag_rules_priority_idx").on(table.priority),
  ],
);

// ── Relations ───────────────────────────────────────────────────────────────
export const featureFlagsRelations = relations(
  featureFlags,
  ({ one, many }) => ({
    createdByAdmin: one(adminUsers, {
      fields: [featureFlags.createdBy],
      references: [adminUsers.id],
    }),
    rules: many(featureFlagRules),
  }),
);

export const featureFlagRulesRelations = relations(
  featureFlagRules,
  ({ one }) => ({
    flag: one(featureFlags, {
      fields: [featureFlagRules.flagId],
      references: [featureFlags.id],
    }),
  }),
);
