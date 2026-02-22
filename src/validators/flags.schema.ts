import { z } from 'zod';

export const evaluateFlagsSchema = z.object({
  userId: z.string().uuid(),
  subscriptionTier: z.enum(['free', 'premium', 'pro', 'enterprise']),
  platform: z.enum(['ios', 'android', 'web']),
  appVersion: z.string().max(20),
  locale: z.string().max(10).default('en'),
  deviceModel: z.string().max(100).optional(),
  country: z.string().max(10).optional(),
  customAttributes: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type EvaluateFlagsInput = z.infer<typeof evaluateFlagsSchema>;
