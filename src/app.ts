import { Hono } from 'hono';
import type { AppEnv } from './types/hono';
import { requestId } from './middleware/request-id';
import { requestLogger } from './middleware/logger';
import { createCors } from './middleware/cors';
import { globalErrorHandler } from './middleware/error-handler';
import { health } from './routes/health';
import { api } from './routes/index';

const app = new Hono<AppEnv>();

// Global middleware
app.use('*', requestId);
app.use('*', requestLogger);
app.use('*', createCors());

// Global error handler
app.onError(globalErrorHandler);

// Health check
app.route('/', health);

// API routes
app.route('/api/v1', api);

// 404 handler
app.notFound((c) => {
  return c.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } },
    404,
  );
});

export { app };
