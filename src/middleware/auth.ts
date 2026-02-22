import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types/hono';
import { verifyAccessToken } from '../lib/jwt';
import { AppError } from './error-handler';

export const authRequired = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('UNAUTHORIZED', 'Missing or invalid Authorization header');
  }

  const token = header.slice(7);
  try {
    const payload = await verifyAccessToken(token);
    c.set('auth', { userId: payload.sub, tier: payload.tier });
  } catch (err: any) {
    if (err?.code === 'ERR_JWT_EXPIRED') {
      throw new AppError('TOKEN_EXPIRED');
    }
    throw new AppError('TOKEN_INVALID');
  }

  await next();
});

export const authOptional = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('authorization');
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7);
    try {
      const payload = await verifyAccessToken(token);
      c.set('optionalAuth', { userId: payload.sub, tier: payload.tier });
    } catch {
      c.set('optionalAuth', { userId: null, tier: null });
    }
  } else {
    c.set('optionalAuth', { userId: null, tier: null });
  }

  await next();
});
