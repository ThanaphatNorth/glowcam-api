import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types/hono';
import { incrementWithExpiry } from '../lib/redis';
import { AppError } from './error-handler';

interface RateLimitOptions {
  max: number;
  window: number; // seconds
  keyPrefix?: string;
}

export function rateLimit(options: RateLimitOptions) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';
    const userId = c.get('auth')?.userId;
    const identifier = userId ?? ip;
    const key = `ratelimit:${options.keyPrefix ?? 'default'}:${identifier}`;

    try {
      const count = await incrementWithExpiry(key, options.window);

      c.header('X-RateLimit-Limit', String(options.max));
      c.header('X-RateLimit-Remaining', String(Math.max(0, options.max - count)));

      if (count > options.max) {
        c.header('Retry-After', String(options.window));
        throw new AppError('RATE_LIMITED');
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // If Redis is down, allow the request through
      console.error('[RateLimit] Redis error, allowing request:', err);
    }

    await next();
  });
}
