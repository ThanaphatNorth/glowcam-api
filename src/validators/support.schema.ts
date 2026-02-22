import { z } from 'zod';

export const createTicketSchema = z.object({
  subject: z.string().min(1).max(255),
  description: z.string().min(1).max(5000),
  category: z.string().max(50).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const addMessageSchema = z.object({
  message: z.string().min(1).max(5000),
  attachments: z.array(z.object({
    fileName: z.string(),
    fileSize: z.number(),
    mimeType: z.string(),
    url: z.string().url(),
  })).max(5).optional(),
});
export type AddMessageInput = z.infer<typeof addMessageSchema>;

export const ticketQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(50).default(20),
  status: z.enum(['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed']).optional(),
});
export type TicketQueryInput = z.infer<typeof ticketQuerySchema>;
