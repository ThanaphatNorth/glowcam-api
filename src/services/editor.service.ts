/**
 * Editor / AI Service
 *
 * Handles AI-powered beauty suggestions, auto-enhance,
 * and editing tips using the Anthropic Claude API.
 */

import { TIER_LIMITS } from '../config/constants';
import type { SubscriptionTier } from '../config/constants';
import { AppError } from '../middleware/error-handler';

// ── Types ───────────────────────────────────────────────────────────────────

export interface BeautySuggestInput {
  mediaId: string;
  analysisData: Record<string, unknown>;
}

export interface AutoEnhanceInput {
  mediaId: string;
}

export interface EditingTipsInput {
  mediaId: string;
  currentParams: Record<string, unknown>;
}

export interface BeautySuggestResult {
  suggestions: {
    parameter: string;
    value: number;
    reason: string;
  }[];
}

export interface AutoEnhanceResult {
  parameters: Record<string, number>;
  description: string;
}

export interface EditingTipsResult {
  tips: {
    tip: string;
    parameter: string;
    suggestedValue: number;
  }[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function checkAiAccess(tier: string): void {
  const limits = TIER_LIMITS[tier as SubscriptionTier];
  if (!limits) {
    throw new AppError('SUBSCRIPTION_REQUIRED', 'Invalid subscription tier');
  }
}

// ── Public Functions ────────────────────────────────────────────────────────

/**
 * Suggest beauty parameters based on image analysis data.
 */
export async function suggestBeautyParams(
  userId: string,
  tier: string,
  input: BeautySuggestInput,
): Promise<BeautySuggestResult> {
  checkAiAccess(tier);

  // TODO: Integrate with Anthropic Claude API for real suggestions
  // For now, return sensible defaults based on analysis data
  return {
    suggestions: [
      { parameter: 'skinSmoothing', value: 0.4, reason: 'Moderate smoothing for natural look' },
      { parameter: 'brightness', value: 0.1, reason: 'Slight brightness increase for better exposure' },
      { parameter: 'warmth', value: 0.05, reason: 'Subtle warmth for skin tone enhancement' },
    ],
  };
}

/**
 * Auto-enhance a photo using AI analysis.
 */
export async function autoEnhance(
  userId: string,
  tier: string,
  input: AutoEnhanceInput,
): Promise<AutoEnhanceResult> {
  checkAiAccess(tier);

  // TODO: Integrate with Anthropic Claude API for real enhancement
  return {
    parameters: {
      brightness: 0.05,
      contrast: 0.1,
      saturation: 0.08,
      sharpness: 0.15,
      warmth: 0.03,
      highlights: -0.1,
      shadows: 0.12,
    },
    description: 'Auto-enhanced with balanced adjustments for natural look',
  };
}

/**
 * Get AI-powered editing tips based on current parameters.
 */
export async function getEditingTips(
  userId: string,
  tier: string,
  input: EditingTipsInput,
): Promise<EditingTipsResult> {
  checkAiAccess(tier);

  // TODO: Integrate with Anthropic Claude API for real tips
  return {
    tips: [
      { tip: 'Try reducing highlights to recover detail in bright areas', parameter: 'highlights', suggestedValue: -0.2 },
      { tip: 'Increase shadows slightly to brighten dark areas', parameter: 'shadows', suggestedValue: 0.15 },
      { tip: 'A touch of clarity can add definition to your subject', parameter: 'clarity', suggestedValue: 0.1 },
    ],
  };
}
