import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  senderTypeEnum,
  ticketPriorityEnum,
  ticketStatusEnum,
} from "./enums";
import { users } from "./users";
import { adminUsers } from "./admin";

// ── Support Tickets ─────────────────────────────────────────────────────────
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    subject: varchar("subject", { length: 255 }).notNull(),
    description: text("description").notNull(),
    status: ticketStatusEnum("status").default("open"),
    priority: ticketPriorityEnum("priority").default("medium"),
    category: varchar("category", { length: 50 }),
    assignedTo: uuid("assigned_to").references(() => adminUsers.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("support_tickets_user_id_idx").on(table.userId),
    index("support_tickets_status_idx").on(table.status),
    index("support_tickets_assigned_to_idx").on(table.assignedTo),
    index("support_tickets_priority_idx").on(table.priority),
  ],
);

// ── Ticket Messages ─────────────────────────────────────────────────────────
export const ticketMessages = pgTable(
  "ticket_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    senderType: senderTypeEnum("sender_type").notNull(),
    senderId: uuid("sender_id").notNull(),
    message: text("message").notNull(),
    attachments: jsonb("attachments").default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("ticket_messages_ticket_id_idx").on(table.ticketId),
    index("ticket_messages_sender_id_idx").on(table.senderId),
  ],
);

// ── Relations ───────────────────────────────────────────────────────────────
export const supportTicketsRelations = relations(
  supportTickets,
  ({ one, many }) => ({
    user: one(users, {
      fields: [supportTickets.userId],
      references: [users.id],
    }),
    assignedAdmin: one(adminUsers, {
      fields: [supportTickets.assignedTo],
      references: [adminUsers.id],
    }),
    messages: many(ticketMessages),
  }),
);

export const ticketMessagesRelations = relations(
  ticketMessages,
  ({ one }) => ({
    ticket: one(supportTickets, {
      fields: [ticketMessages.ticketId],
      references: [supportTickets.id],
    }),
  }),
);
