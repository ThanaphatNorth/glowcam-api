/**
 * Support Service
 *
 * Handles support ticket creation, listing, retrieval,
 * and message threading.
 */

import { AppError } from '../middleware/error-handler';

// ── Types ───────────────────────────────────────────────────────────────────

export interface Ticket {
  id: string;
  userId: string;
  subject: string;
  description: string;
  category: string | null;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  userId: string;
  message: string;
  attachments: unknown[];
  createdAt: string;
}

export interface CreateTicketInput {
  subject: string;
  description: string;
  category?: string;
  priority?: string;
}

export interface AddMessageInput {
  message: string;
  attachments?: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    url: string;
  }[];
}

export interface ListTicketsQuery {
  status?: string;
  page: number;
  limit: number;
}

export interface ListTicketsResult {
  data: Ticket[];
  total: number;
}

// ── Public Functions ────────────────────────────────────────────────────────

/**
 * Create a new support ticket.
 */
export async function createTicket(
  userId: string,
  input: CreateTicketInput,
): Promise<Ticket> {
  // TODO: Insert into database
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    userId,
    subject: input.subject,
    description: input.description,
    category: input.category ?? null,
    priority: input.priority ?? 'medium',
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * List support tickets for a user.
 */
export async function listTickets(
  userId: string,
  query: ListTicketsQuery,
): Promise<ListTicketsResult> {
  // TODO: Query from database with filtering and pagination
  return {
    data: [],
    total: 0,
  };
}

/**
 * Get a single support ticket with messages.
 */
export async function getTicket(
  userId: string,
  ticketId: string,
): Promise<Ticket | null> {
  // TODO: Query from database
  return null;
}

/**
 * Add a message to a support ticket.
 */
export async function addMessage(
  userId: string,
  ticketId: string,
  input: AddMessageInput,
): Promise<TicketMessage> {
  // TODO: Verify ticket exists and is not closed, insert message
  return {
    id: crypto.randomUUID(),
    ticketId,
    userId,
    message: input.message,
    attachments: input.attachments ?? [],
    createdAt: new Date().toISOString(),
  };
}
