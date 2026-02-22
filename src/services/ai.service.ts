/**
 * AI Service
 *
 * Provides AI-powered photo enhancement features including beauty parameter
 * suggestions, auto-enhance, and contextual editing tips.
 * Includes per-tier rate limiting and response caching.
 */

import { eq, and } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { db } from '../db/client';
import { media } from '../db/schema';
import { askClaude } from '../lib/claude';
import { getCache, setCache, incrementWithExpiry } from '../lib/redis';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SuggestBeautyParamsInput {
  userId: string;
  mediaId: string;
  tier: string;
  faceAnalysisData?: Record<string, unknown>;
}

export interface AutoEnhanceInput {
  userId: string;
  mediaId: string;
  tier: string;
  imageMetadata?: Record<string, unknown>;
}

export interface EditingTipsInput {
  userId: string;
  mediaId: string;
  tier: string;
  currentParams?: Record<string, unknown>;
}

export interface BeautySuggestion {
  parameter: string;
  value: number;
  reason: string;
  category: 'skin' | 'lighting' | 'color' | 'detail' | 'artistic';
}

export interface EnhanceResult {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  sharpness: number;
  highlights: number;
  shadows: number;
  clarity: number;
  vibrance: number;
  exposure: number;
}

export interface EditingTip {
  tip: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  suggestedAction?: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const AI_DAILY_LIMITS: Record<string, number> = {
  free: 0,
  premium: 10,
  pro: 50,
  enterprise: Infinity,
};

const CACHE_TTL_SECONDS = 3600; // 1 hour
const RATE_LIMIT_TTL_SECONDS = 86400; // 24 hours

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a date-based rate limit key for a user.
 */
function getRateLimitKey(userId: string): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `ai:rate:${userId}:${today}`;
}

/**
 * Build a cache key from input data using SHA-256 hash.
 */
function getCacheKey(prefix: string, data: unknown): string {
  const hash = createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex')
    .slice(0, 16);
  return `ai:cache:${prefix}:${hash}`;
}

/**
 * Check if the user has exceeded their daily AI usage limit.
 * Increments the counter and throws if limit reached.
 */
async function checkAndIncrementRateLimit(
  userId: string,
  tier: string,
): Promise<void> {
  const limit = AI_DAILY_LIMITS[tier] ?? AI_DAILY_LIMITS.free!;

  if (limit === 0) {
    throw new Error(
      'AI features are not available on the free tier. Please upgrade your plan.',
    );
  }

  if (limit === Infinity) {
    return; // No limit for enterprise
  }

  const key = getRateLimitKey(userId);
  const count = await incrementWithExpiry(key, RATE_LIMIT_TTL_SECONDS);

  if (count > limit) {
    throw new Error(
      `Daily AI usage limit reached (${limit} requests). Limit resets at midnight UTC.`,
    );
  }
}

/**
 * Fetch the media record and verify ownership for AI processing.
 */
async function getMediaForAI(
  mediaId: string,
  userId: string,
): Promise<typeof media.$inferSelect> {
  const [item] = await db
    .select()
    .from(media)
    .where(
      and(
        eq(media.id, mediaId),
        eq(media.userId, userId),
      ),
    )
    .limit(1);

  if (!item) {
    throw new Error('Media not found or access denied');
  }

  if (item.status !== 'ready') {
    throw new Error('Media is not ready for AI processing. Current status: ' + item.status);
  }

  return item;
}

/**
 * Parse a JSON response from the AI model, handling code blocks.
 */
function parseAiResponse<T>(text: string): T {
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonString = jsonBlockMatch ? jsonBlockMatch[1]!.trim() : text.trim();

  try {
    return JSON.parse(jsonString) as T;
  } catch {
    throw new Error(
      `Failed to parse AI response. Raw: ${text.substring(0, 200)}`,
    );
  }
}

// ── Public Functions ────────────────────────────────────────────────────────

/**
 * Suggest beauty enhancement parameters for a photo using AI analysis.
 * Results are cached per unique input data.
 */
export async function suggestBeautyParams(
  input: SuggestBeautyParamsInput,
): Promise<BeautySuggestion[]> {
  const { userId, mediaId, tier, faceAnalysisData } = input;

  await checkAndIncrementRateLimit(userId, tier);

  const mediaItem = await getMediaForAI(mediaId, userId);

  // Build context for AI
  const aiContext = {
    mediaId,
    mimeType: mediaItem.mimeType,
    width: mediaItem.width,
    height: mediaItem.height,
    metadata: mediaItem.metadata,
    faceAnalysis: faceAnalysisData ?? {},
  };

  // Check cache
  const cacheKey = getCacheKey('beauty', aiContext);
  const cached = await getCache<BeautySuggestion[]>(cacheKey);
  if (cached) return cached;

  const systemPrompt = `You are a professional photo retouching and beauty AI assistant for the GlowCam app.
You analyze facial data and suggest precise beauty enhancement parameters.
Always respond with valid JSON only, no additional text.
Each suggestion must have: parameter (string), value (number 0-100), reason (string), and category (one of: skin, lighting, color, detail, artistic).`;

  const userPrompt = `Based on the following image and face analysis data, provide beauty enhancement suggestions as a JSON array:

${JSON.stringify(aiContext, null, 2)}

Respond with a JSON array of suggestions.`;

  const text = await askClaude(systemPrompt, userPrompt, {
    maxTokens: 2048,
    temperature: 0.3,
  });

  const suggestions = parseAiResponse<BeautySuggestion[]>(text);

  // Cache the result
  await setCache(cacheKey, suggestions, CACHE_TTL_SECONDS);

  return suggestions;
}

/**
 * Generate auto-enhance parameters for a photo using AI analysis.
 * Results are cached per unique input data.
 */
export async function autoEnhance(
  input: AutoEnhanceInput,
): Promise<EnhanceResult> {
  const { userId, mediaId, tier, imageMetadata } = input;

  await checkAndIncrementRateLimit(userId, tier);

  const mediaItem = await getMediaForAI(mediaId, userId);

  const aiContext = {
    mediaId,
    mimeType: mediaItem.mimeType,
    width: mediaItem.width,
    height: mediaItem.height,
    metadata: mediaItem.metadata,
    imageMetadata: imageMetadata ?? {},
  };

  // Check cache
  const cacheKey = getCacheKey('enhance', aiContext);
  const cached = await getCache<EnhanceResult>(cacheKey);
  if (cached) return cached;

  const systemPrompt = `You are a professional photo editor AI for the GlowCam app.
You analyze image metadata and suggest optimal enhancement parameters.
Always respond with valid JSON only, no additional text.
All parameter values must be between -100 and 100 (0 means no change).`;

  const userPrompt = `Based on the following image metadata, provide optimal auto-enhance parameters as a JSON object:

${JSON.stringify(aiContext, null, 2)}

Respond with a JSON object containing these exact keys:
brightness, contrast, saturation, warmth, sharpness, highlights, shadows, clarity, vibrance, exposure`;

  const text = await askClaude(systemPrompt, userPrompt, {
    maxTokens: 2048,
    temperature: 0.2,
  });

  const params = parseAiResponse<EnhanceResult>(text);

  // Cache the result
  await setCache(cacheKey, params, CACHE_TTL_SECONDS);

  return params;
}

/**
 * Get contextual editing tips for a photo based on current editing state.
 * Results are cached per unique input data.
 */
export async function getEditingTips(
  input: EditingTipsInput,
): Promise<EditingTip[]> {
  const { userId, mediaId, tier, currentParams } = input;

  await checkAndIncrementRateLimit(userId, tier);

  const mediaItem = await getMediaForAI(mediaId, userId);

  const aiContext = {
    mediaId,
    mimeType: mediaItem.mimeType,
    width: mediaItem.width,
    height: mediaItem.height,
    metadata: mediaItem.metadata,
    currentParams: currentParams ?? {},
  };

  // Check cache
  const cacheKey = getCacheKey('tips', aiContext);
  const cached = await getCache<EditingTip[]>(cacheKey);
  if (cached) return cached;

  const systemPrompt = `You are a professional photo editing coach for the GlowCam app.
You provide helpful, actionable editing tips based on the current image state and user's editing choices.
Always respond with valid JSON only, no additional text.
Limit to 3-5 most relevant tips.`;

  const userPrompt = `Based on the following image metadata and current editing parameters, provide contextual editing tips as a JSON array:

Image context:
${JSON.stringify(aiContext, null, 2)}

Respond with a JSON array of tips. Each tip must have: tip (string), priority (high/medium/low), category (string), and optionally suggestedAction (string).`;

  const text = await askClaude(systemPrompt, userPrompt, {
    maxTokens: 2048,
    temperature: 0.4,
  });

  const tips = parseAiResponse<EditingTip[]>(text);

  // Cache the result
  await setCache(cacheKey, tips, CACHE_TTL_SECONDS);

  return tips;
}
