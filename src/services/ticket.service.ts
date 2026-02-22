/**
 * Ticket Service
 *
 * Support ticket CRUD with message threading,
 * auto-status transitions, and pagination.
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { supportTickets, ticketMessages } from '../db/schema';

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreateTicketInput {
  userId: string;
  subject: string;
  description: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  initialMessage?: string;
}

export interface ListTicketsInput {
  userId: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface AddMessageInput {
  ticketId: string;
  senderId: string;
  senderType: 'user' | 'admin' | 'system';
  message: string;
  attachments?: unknown[];
}

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

// ── Public Functions ────────────────────────────────────────────────────────

/**
 * Create a support ticket with an optional initial message.
 */
export async function createTicket(
  input: CreateTicketInput,
): Promise<typeof supportTickets.$inferSelect> {
  const { userId, subject, description, category, priority, initialMessage } = input;

  const [ticket] = await db
    .insert(supportTickets)
    .values({
      userId,
      subject,
      description,
      category: category ?? null,
      priority: priority ?? 'medium',
      status: 'open',
    })
    .returning();

  if (!ticket) {
    throw new Error('Failed to create support ticket');
  }

  // Add initial message if provided
  if (initialMessage) {
    await db.insert(ticketMessages).values({
      ticketId: ticket.id,
      senderType: 'user',
      senderId: userId,
      message: initialMessage,
      attachments: [],
    });
  }

  return ticket;
}

/**
 * List support tickets for a user with optional status filter.
 */
export async function listTickets(
  input: ListTicketsInput,
): Promise<{
  items: (typeof supportTickets.$inferSelect)[];
  total: number;
  page: number;
  limit: number;
}> {
  const {
    userId,
    status,
    page = 1,
    limit: rawLimit = DEFAULT_PAGE_SIZE,
  } = input;

  const limit = Math.min(Math.max(rawLimit, 1), MAX_PAGE_SIZE);
  const offset = (Math.max(page, 1) - 1) * limit;

  const conditions = [eq(supportTickets.userId, userId)];

  if (status) {
    conditions.push(eq(supportTickets.status, status as any));
  }

  const whereClause = and(...conditions);

  const [countResult, items] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(supportTickets)
      .where(whereClause),
    db
      .select()
      .from(supportTickets)
      .where(whereClause)
      .orderBy(desc(supportTickets.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  return {
    items,
    total: countResult[0]?.count ?? 0,
    page,
    limit,
  };
}

/**
 * Get a single ticket with all its messages ordered chronologically.
 * Verifies ownership.
 */
export async function getTicket(
  ticketId: string,
  userId: string,
): Promise<{
  ticket: typeof supportTickets.$inferSelect;
  messages: (typeof ticketMessages.$inferSelect)[];
}> {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.id, ticketId),
        eq(supportTickets.userId, userId),
      ),
    )
    .limit(1);

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const messages = await db
    .select()
    .from(ticketMessages)
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(ticketMessages.createdAt);

  return { ticket, messages };
}

/**
 * Add a message to a ticket.
 *
 * Auto-transitions:
 * - If status is 'waiting_on_user' and user replies, moves to 'in_progress'.
 * - Rejects messages on 'closed' tickets.
 */
export async function addMessage(
  input: AddMessageInput,
): Promise<typeof ticketMessages.$inferSelect> {
  const { ticketId, senderId, senderType, message, attachments } = input;

  // Fetch the ticket to check status
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  // Reject messages on closed tickets
  if (ticket.status === 'closed') {
    throw new Error(
      'Cannot add messages to a closed ticket. Please create a new ticket.',
    );
  }

  // Insert the message
  const [newMessage] = await db
    .insert(ticketMessages)
    .values({
      ticketId,
      senderType,
      senderId,
      message,
      attachments: attachments ?? [],
    })
    .returning();

  if (!newMessage) {
    throw new Error('Failed to add message');
  }

  // Auto-transition: if status is waiting_on_user and user replies, move to in_progress
  if (ticket.status === 'waiting_on_user' && senderType === 'user') {
    await db
      .update(supportTickets)
      .set({
        status: 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, ticketId));
  }

  // Update ticket's updatedAt timestamp
  await db
    .update(supportTickets)
    .set({ updatedAt: new Date() })
    .where(eq(supportTickets.id, ticketId));

  return newMessage;
}
