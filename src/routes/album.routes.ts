import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
import { successResponse, errorResponse, paginatedResponse } from '../types/api';
import { authRequired } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { AppError } from '../middleware/error-handler';
import * as albumService from '../services/album.service';
import {
  createAlbumSchema,
  updateAlbumSchema,
  addMediaToAlbumSchema,
} from '../validators/album.schema';

const albumRoutes = new Hono<AppEnv>();

// POST / - Create a new album
albumRoutes.post(
  '/',
  authRequired,
  validateBody(createAlbumSchema),
  async (c) => {
    const { userId, tier } = c.get('auth');
    const body = c.req.valid('json' as never) as {
      name: string;
      description?: string;
      coverMediaId?: string;
    };
    const album = await albumService.createAlbum({
      userId,
      name: body.name,
      description: body.description,
      tier,
    });
    return c.json(successResponse(album), 201);
  },
);

// GET / - List user albums with pagination
albumRoutes.get('/', authRequired, async (c) => {
  const { userId } = c.get('auth');

  const page = parseInt(c.req.query('page') ?? '1', 10);
  const limit = parseInt(c.req.query('limit') ?? '20', 10);

  const result = await albumService.listAlbums({ userId, page, limit });

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

// GET /:id - Get a single album
albumRoutes.get('/:id', authRequired, async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  const includeMedia = c.req.query('includeMedia') === 'true';

  try {
    const result = await albumService.getAlbum({
      albumId: id,
      userId,
      includeMedia,
    });
    return c.json(successResponse(result));
  } catch {
    throw new AppError('NOT_FOUND', 'Album not found');
  }
});

// PUT /:id - Update an album
albumRoutes.put(
  '/:id',
  authRequired,
  validateBody(updateAlbumSchema),
  async (c) => {
    const { userId } = c.get('auth');
    const id = c.req.param('id');
    const body = c.req.valid('json' as never) as {
      name?: string;
      description?: string | null;
      coverMediaId?: string | null;
      sortOrder?: number;
    };
    const updated = await albumService.updateAlbum({
      albumId: id,
      userId,
      name: body.name,
      description: body.description ?? undefined,
      coverMediaId: body.coverMediaId,
      sortOrder: body.sortOrder,
    });
    return c.json(successResponse(updated));
  },
);

// DELETE /:id - Delete an album
albumRoutes.delete('/:id', authRequired, async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  await albumService.deleteAlbum(id, userId);
  return c.json(successResponse({ message: 'Album deleted successfully' }));
});

// POST /:id/media - Add media to album
albumRoutes.post(
  '/:id/media',
  authRequired,
  validateBody(addMediaToAlbumSchema),
  async (c) => {
    const { userId } = c.get('auth');
    const id = c.req.param('id');
    const body = c.req.valid('json' as never) as { mediaIds: string[] };
    const result = await albumService.addMediaToAlbum({
      albumId: id,
      userId,
      mediaIds: body.mediaIds,
    });
    return c.json(successResponse(result));
  },
);

// DELETE /:id/media/:mediaId - Remove media from album
albumRoutes.delete('/:id/media/:mediaId', authRequired, async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  const mediaId = c.req.param('mediaId');
  await albumService.removeMediaFromAlbum({
    albumId: id,
    userId,
    mediaIds: [mediaId],
  });
  return c.json(successResponse({ message: 'Media removed from album' }));
});

export { albumRoutes };
