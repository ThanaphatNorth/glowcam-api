import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
import { successResponse, errorResponse, paginatedResponse } from '../types/api';
import { authRequired } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { AppError } from '../middleware/error-handler';
import * as mediaService from '../services/media.service';
import {
  presignUploadSchema,
  updateMediaSchema,
  confirmUploadSchema,
} from '../validators/media.schema';

const mediaRoutes = new Hono<AppEnv>();

// POST /presign - Create presigned upload URL
mediaRoutes.post(
  '/presign',
  authRequired,
  validateBody(presignUploadSchema),
  async (c) => {
    const { userId } = c.get('auth');
    const body = c.req.valid('json' as never) as {
      fileName: string;
      mimeType: string;
      fileSize: number;
    };
    const isVideo = body.mimeType.startsWith('video/');
    const result = await mediaService.createPresignedUpload({
      userId,
      filename: body.fileName,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      type: isVideo ? 'video' : 'photo',
    });
    return c.json(successResponse(result), 201);
  },
);

// GET / - List user media with pagination and filters
mediaRoutes.get('/', authRequired, async (c) => {
  const { userId } = c.get('auth');

  const page = parseInt(c.req.query('page') ?? '1', 10);
  const limit = parseInt(c.req.query('limit') ?? '20', 10);
  const type = c.req.query('type') as 'photo' | 'video' | undefined;
  const favoriteParam = c.req.query('favorite');
  const isFavorite =
    favoriteParam === 'true' ? true : favoriteParam === 'false' ? false : undefined;

  const result = await mediaService.listMedia({ userId, page, limit, type, isFavorite });

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

// GET /:id - Get single media item
mediaRoutes.get('/:id', authRequired, async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  try {
    const item = await mediaService.getMedia(id, userId);
    return c.json(successResponse(item));
  } catch {
    throw new AppError('MEDIA_NOT_FOUND');
  }
});

// PUT /:id - Update media metadata or confirm upload
mediaRoutes.put('/:id', authRequired, async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Invalid JSON in request body');
  }

  // If the body contains upload confirmation fields (width/height/duration),
  // treat as confirm upload; otherwise treat as metadata update
  if ('width' in body || 'height' in body || 'duration' in body) {
    const parsed = confirmUploadSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', details);
    }
    const result = await mediaService.confirmUpload({ mediaId: id, userId });
    return c.json(successResponse(result));
  }

  const parsed = updateMediaSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    throw new AppError('VALIDATION_ERROR', 'Request validation failed', details);
  }
  const result = await mediaService.updateMedia({
    mediaId: id,
    userId,
    isFavorite: parsed.data.isFavorite,
    metadata: parsed.data.metadata as Record<string, unknown> | undefined,
  });
  return c.json(successResponse(result));
});

// DELETE /:id - Delete media item
mediaRoutes.delete('/:id', authRequired, async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  await mediaService.deleteMedia(id, userId);
  return c.json(successResponse({ message: 'Media deleted successfully' }));
});

export { mediaRoutes };
