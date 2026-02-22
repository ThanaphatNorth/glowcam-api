import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ERROR_CODE_MAP, type ErrorCodeKey } from '../config/constants';
import { errorResponse } from '../types/api';

export class AppError extends Error {
  public readonly code: ErrorCodeKey;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: ErrorCodeKey, message?: string, details?: unknown) {
    const mapped = ERROR_CODE_MAP[code];
    super(message ?? mapped.message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = mapped.httpStatus;
    this.details = details;
  }
}

export function globalErrorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(errorResponse(err.code, err.message, err.details), err.statusCode as any);
  }

  if (err instanceof HTTPException) {
    return c.json(errorResponse('UNKNOWN_ERROR', err.message), err.status);
  }

  console.error('[Unhandled Error]', err);
  return c.json(errorResponse('INTERNAL_SERVER_ERROR', 'Internal server error'), 500);
}
