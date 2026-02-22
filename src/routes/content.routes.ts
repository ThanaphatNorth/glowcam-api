import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
import { successResponse, errorResponse, paginatedResponse } from '../types/api';
import { authRequired, authOptional } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import * as contentService from '../services/content.service';

const contentRoutes = new Hono<AppEnv>();

// GET / - List content (tutorials, tips, presets) with optional auth
contentRoutes.get('/', authOptional, async (c) => {
  const optionalAuth = c.get('optionalAuth');
  const tier = optionalAuth?.tier ?? 'free';

  const page = parseInt(c.req.query('page') ?? '1', 10);
  const limit = parseInt(c.req.query('limit') ?? '20', 10);
  const type = c.req.query('type') ?? undefined;
  const category = c.req.query('category') ?? undefined;

  const result = await contentService.listContent({ tier, type, category, page, limit });

  return c.json(
    paginatedResponse(result.items, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit),
      hasNext: result.page * result.limit < result.total,
      hasPrev: result.page > 1,
    }),
  );
});

// GET /:id - Get single content item
contentRoutes.get('/:id', authOptional, async (c) => {
  const optionalAuth = c.get('optionalAuth');
  const tier = optionalAuth?.tier ?? 'free';
  const id = c.req.param('id');

  try {
    const item = await contentService.getContent(id, tier);
    return c.json(successResponse(item));
  } catch {
    throw new AppError('CONTENT_NOT_FOUND');
  }
});

// POST /:id/download - Download content (requires auth)
contentRoutes.post('/:id/download', authRequired, async (c) => {
  const { userId, tier } = c.get('auth');
  const id = c.req.param('id');
  const result = await contentService.downloadContent(id, userId, tier);
  return c.json(successResponse(result));
});

export { contentRoutes };
