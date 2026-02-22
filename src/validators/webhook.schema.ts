import { z } from 'zod';

export const revenuecatWebhookSchema = z.object({
  api_version: z.string().optional(),
  event: z.object({
    type: z.string(),
    id: z.string(),
    app_user_id: z.string(),
    product_id: z.string().optional(),
    period_type: z.string().optional(),
    purchased_at_ms: z.number().optional(),
    expiration_at_ms: z.number().optional(),
    environment: z.string().optional(),
    store: z.string().optional(),
    is_trial_conversion: z.boolean().optional(),
  }),
});
export type RevenuecatWebhookInput = z.infer<typeof revenuecatWebhookSchema>;
