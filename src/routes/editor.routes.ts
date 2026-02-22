import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
import { successResponse, errorResponse } from '../types/api';
import { authRequired } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { validateBody } from '../middleware/validate';
import { RATE_LIMIT_PRESETS } from '../config/constants';
import * as editorService from '../services/editor.service';
import {
  beautySuggestSchema,
  autoEnhanceSchema,
  editingTipsSchema,
} from '../validators/editor.schema';

const editorRoutes = new Hono<AppEnv>();

// POST /suggest - Get beauty parameter suggestions from AI
editorRoutes.post(
  '/suggest',
  authRequired,
  rateLimit({ ...RATE_LIMIT_PRESETS.ai, keyPrefix: 'ai:suggest' }),
  validateBody(beautySuggestSchema),
  async (c) => {
    const { userId, tier } = c.get('auth');
    const body = c.req.valid('json' as never) as Record<string, unknown>;
    const result = await editorService.suggestBeautyParams(userId, tier, {
      mediaId: (body.mediaId as string) ?? 'default',
      analysisData: body,
    });
    return c.json(successResponse(result));
  },
);

// POST /auto-enhance - Auto-enhance a photo using AI
editorRoutes.post(
  '/auto-enhance',
  authRequired,
  rateLimit({ ...RATE_LIMIT_PRESETS.ai, keyPrefix: 'ai:auto-enhance' }),
  validateBody(autoEnhanceSchema),
  async (c) => {
    const { userId, tier } = c.get('auth');
    const body = c.req.valid('json' as never) as Record<string, unknown>;
    const result = await editorService.autoEnhance(userId, tier, {
      mediaId: (body.mediaId as string) ?? 'default',
    });
    return c.json(successResponse(result));
  },
);

// POST /tips - Get editing tips from AI
editorRoutes.post(
  '/tips',
  authRequired,
  rateLimit({ ...RATE_LIMIT_PRESETS.ai, keyPrefix: 'ai:tips' }),
  validateBody(editingTipsSchema),
  async (c) => {
    const { userId, tier } = c.get('auth');
    const body = c.req.valid('json' as never) as { currentParams: Record<string, unknown> };
    const result = await editorService.getEditingTips(userId, tier, {
      mediaId: 'default',
      currentParams: body.currentParams,
    });
    return c.json(successResponse(result));
  },
);

// GET /presets - Get list of available editor presets
editorRoutes.get('/presets', authRequired, async (c) => {
  const { tier } = c.get('auth');

  // Static presets list filtered by tier
  const presets = [
    { id: 'natural', name: 'Natural', category: 'basic', minTier: 'free' },
    { id: 'bright', name: 'Bright & Airy', category: 'basic', minTier: 'free' },
    { id: 'warm', name: 'Warm Glow', category: 'basic', minTier: 'free' },
    { id: 'cool', name: 'Cool Tone', category: 'basic', minTier: 'free' },
    { id: 'vivid', name: 'Vivid', category: 'basic', minTier: 'free' },
    { id: 'soft-skin', name: 'Soft Skin', category: 'beauty', minTier: 'free' },
    { id: 'portrait-pro', name: 'Portrait Pro', category: 'beauty', minTier: 'premium' },
    { id: 'studio-light', name: 'Studio Light', category: 'beauty', minTier: 'premium' },
    { id: 'golden-hour', name: 'Golden Hour', category: 'premium', minTier: 'premium' },
    { id: 'film-grain', name: 'Film Grain', category: 'premium', minTier: 'premium' },
    { id: 'moody', name: 'Moody', category: 'premium', minTier: 'premium' },
    { id: 'cinematic', name: 'Cinematic', category: 'pro', minTier: 'pro' },
    { id: 'fashion', name: 'Fashion Editorial', category: 'pro', minTier: 'pro' },
    { id: 'hdr-natural', name: 'HDR Natural', category: 'pro', minTier: 'pro' },
    { id: 'color-grade-teal', name: 'Teal & Orange', category: 'pro', minTier: 'pro' },
    { id: 'magazine', name: 'Magazine Cover', category: 'pro', minTier: 'pro' },
  ];

  const tierOrder = ['free', 'premium', 'pro', 'enterprise'];
  const userTierIndex = tierOrder.indexOf(tier);

  const available = presets.map((preset) => ({
    ...preset,
    locked: tierOrder.indexOf(preset.minTier) > userTierIndex,
  }));

  return c.json(successResponse(available));
});

export { editorRoutes };
