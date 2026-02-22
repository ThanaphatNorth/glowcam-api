import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
import { successResponse, errorResponse } from '../types/api';
import { authRequired } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as flagsService from '../services/flags.service';
import { evaluateFlagsSchema } from '../validators/flags.schema';

const flagsRoutes = new Hono<AppEnv>();

// POST /evaluate - Evaluate all feature flags for a user
flagsRoutes.post(
  '/evaluate',
  authRequired,
  validateBody(evaluateFlagsSchema),
  async (c) => {
    const body = c.req.valid('json' as never) as {
      userId: string;
      [key: string]: unknown;
    };
    const result = await flagsService.evaluateAllFlags(body.userId, body);
    return c.json(successResponse(result));
  },
);

export { flagsRoutes };
