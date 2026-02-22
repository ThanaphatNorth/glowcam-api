import { z } from 'zod';

export const batchEventsSchema = z.object({
  events: z.array(z.object({
    eventType: z.string().min(1).max(100),
    properties: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    sessionId: z.string().max(100).optional(),
    platform: z.enum(['ios', 'android', 'web']).optional(),
    appVersion: z.string().max(20).optional(),
    deviceId: z.string().max(255).optional(),
    timestamp: z.string().datetime().optional(),
  })).min(1).max(100),
});
export type BatchEventsInput = z.infer<typeof batchEventsSchema>;
