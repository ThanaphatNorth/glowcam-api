import { createMiddleware } from 'hono/factory';
import type { ZodSchema } from 'zod';
import { AppError } from './error-handler';

export function validateBody<T extends Record<string, unknown>>(schema: ZodSchema<T>) {
  return createMiddleware(async (c, next) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new AppError('VALIDATION_ERROR', 'Invalid JSON in request body');
    }

    const result = schema.safeParse(body);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', details);
    }

    c.req.addValidatedData('json', result.data);
    await next();
  });
}

export function validateQuery<T extends Record<string, unknown>>(schema: ZodSchema<T>) {
  return createMiddleware(async (c, next) => {
    const query = c.req.query();
    // Convert string numbers to actual numbers for zod coercion
    const parsed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value === 'true') parsed[key] = true;
      else if (value === 'false') parsed[key] = false;
      else if (!isNaN(Number(value)) && value !== '') parsed[key] = Number(value);
      else parsed[key] = value;
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      throw new AppError('VALIDATION_ERROR', 'Query parameter validation failed', details);
    }

    c.req.addValidatedData('query', result.data);
    await next();
  });
}
