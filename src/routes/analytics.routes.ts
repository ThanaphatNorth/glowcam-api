import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
import { successResponse, errorResponse } from '../types/api';
import { authRequired } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { validateBody } from '../middleware/validate';
import { RATE_LIMIT_PRESETS } from '../config/constants';
import * as analyticsService from '../services/analytics.service';
import { batchEventsSchema } from '../validators/analytics.schema';

const analyticsRoutes = new Hono<AppEnv>();

// POST /events - Ingest a batch of analytics events
analyticsRoutes.post(
  '/events',
  authRequired,
  rateLimit({ ...RATE_LIMIT_PRESETS.analytics, keyPrefix: 'analytics:events' }),
  validateBody(batchEventsSchema),
  async (c) => {
    const { userId } = c.get('auth');
    const body = c.req.valid('json' as never) as {
      events: analyticsService.AnalyticsEvent[];
    };
    // Stamp each event with the authenticated userId
    const enrichedEvents = body.events.map((event) => ({
      ...event,
      userId,
    }));
    const result = await analyticsService.ingestEvents(enrichedEvents);
    return c.json(successResponse(result));
  },
);

export { analyticsRoutes };
