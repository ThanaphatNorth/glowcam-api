import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
import { successResponse, errorResponse, paginatedResponse } from '../types/api';
import { authRequired } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { AppError } from '../middleware/error-handler';
import * as supportService from '../services/support.service';
import { createTicketSchema, addMessageSchema } from '../validators/support.schema';

const supportRoutes = new Hono<AppEnv>();

// POST / - Create a support ticket
supportRoutes.post(
  '/',
  authRequired,
  validateBody(createTicketSchema),
  async (c) => {
    const { userId } = c.get('auth');
    const body = c.req.valid('json' as never);
    const ticket = await supportService.createTicket(userId, body);
    return c.json(successResponse(ticket), 201);
  },
);

// GET / - List user support tickets with pagination
supportRoutes.get('/', authRequired, async (c) => {
  const { userId } = c.get('auth');

  const page = parseInt(c.req.query('page') ?? '1', 10);
  const limit = parseInt(c.req.query('limit') ?? '20', 10);
  const status = c.req.query('status') ?? undefined;

  const query = { status, page, limit };
  const result = await supportService.listTickets(userId, query);

  return c.json(
    paginatedResponse(result.data, {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
      hasNext: page * limit < result.total,
      hasPrev: page > 1,
    }),
  );
});

// GET /:id - Get a single support ticket
supportRoutes.get('/:id', authRequired, async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  const ticket = await supportService.getTicket(userId, id);
  if (!ticket) {
    throw new AppError('NOT_FOUND', 'Support ticket not found');
  }
  return c.json(successResponse(ticket));
});

// POST /:id/messages - Add a message to a support ticket
supportRoutes.post(
  '/:id/messages',
  authRequired,
  validateBody(addMessageSchema),
  async (c) => {
    const { userId } = c.get('auth');
    const id = c.req.param('id');
    const body = c.req.valid('json' as never);
    const message = await supportService.addMessage(userId, id, body);
    return c.json(successResponse(message), 201);
  },
);

export { supportRoutes };
