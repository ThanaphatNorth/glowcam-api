import { Hono } from 'hono';
import { successResponse, errorResponse } from '../types/api';
import { verifyWebhookSignature, handleWebhookEvent } from '../services/webhook.service';

const webhooks = new Hono();

webhooks.post('/revenuecat', async (c) => {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    return c.json(errorResponse('INTERNAL_SERVER_ERROR', 'Webhook not configured'), 500);
  }

  const signature = c.req.header('x-revenuecat-signature') ?? '';
  const rawBody = await c.req.text();

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return c.json(errorResponse('UNAUTHORIZED', 'Invalid webhook signature'), 401);
  }

  try {
    const body = JSON.parse(rawBody);
    const result = await handleWebhookEvent(body.event);
    return c.json(successResponse(result));
  } catch (err: any) {
    return c.json(errorResponse('INTERNAL_SERVER_ERROR', err.message), 500);
  }
});

export { webhooks };
