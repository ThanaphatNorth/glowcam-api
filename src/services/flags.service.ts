/**
 * Feature Flags Service
 *
 * Evaluates feature flags for users based on their attributes
 * (subscription tier, platform, app version, locale, etc.).
 * Uses consistent hashing for percentage-based rollouts.
 */

import { murmurhash3 } from '../lib/crypto';

// ── Types ───────────────────────────────────────────────────────────────────

export interface EvaluateInput {
  userId: string;
  subscriptionTier?: string;
  platform?: string;
  appVersion?: string;
  locale?: string;
  deviceModel?: string;
  country?: string;
  customAttributes?: Record<string, string | number | boolean>;
}

export interface FlagValue {
  key: string;
  enabled: boolean;
  variant?: string;
}

export interface EvaluateResult {
  flags: FlagValue[];
  evaluatedAt: string;
}

// ── Flag Definitions ────────────────────────────────────────────────────────

interface FlagDefinition {
  key: string;
  defaultEnabled: boolean;
  rolloutPercentage: number; // 0-100
  allowedTiers?: string[];
  allowedPlatforms?: string[];
}

const FLAG_DEFINITIONS: FlagDefinition[] = [
  {
    key: 'ai_auto_enhance_v2',
    defaultEnabled: false,
    rolloutPercentage: 50,
    allowedTiers: ['premium', 'pro', 'enterprise'],
  },
  {
    key: 'new_editor_ui',
    defaultEnabled: false,
    rolloutPercentage: 30,
  },
  {
    key: 'video_4k_export',
    defaultEnabled: true,
    rolloutPercentage: 100,
    allowedTiers: ['pro', 'enterprise'],
  },
  {
    key: 'batch_processing',
    defaultEnabled: false,
    rolloutPercentage: 100,
    allowedTiers: ['pro', 'enterprise'],
  },
  {
    key: 'cloud_backup_v2',
    defaultEnabled: false,
    rolloutPercentage: 20,
    allowedTiers: ['premium', 'pro', 'enterprise'],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function evaluateFlag(
  flag: FlagDefinition,
  input: EvaluateInput,
): FlagValue {
  // Check tier restrictions
  if (flag.allowedTiers && input.subscriptionTier) {
    if (!flag.allowedTiers.includes(input.subscriptionTier)) {
      return { key: flag.key, enabled: false };
    }
  }

  // Check platform restrictions
  if (flag.allowedPlatforms && input.platform) {
    if (!flag.allowedPlatforms.includes(input.platform)) {
      return { key: flag.key, enabled: false };
    }
  }

  // Percentage-based rollout using consistent hashing
  if (flag.rolloutPercentage < 100) {
    const hash = murmurhash3(`${flag.key}:${input.userId}`);
    const bucket = hash % 100;
    if (bucket >= flag.rolloutPercentage) {
      return { key: flag.key, enabled: false };
    }
  }

  return { key: flag.key, enabled: flag.defaultEnabled || flag.rolloutPercentage > 0 };
}

// ── Public Functions ────────────────────────────────────────────────────────

/**
 * Evaluate all feature flags for a user.
 */
export async function evaluateAllFlags(
  userId: string,
  input: EvaluateInput,
): Promise<EvaluateResult> {
  const flags = FLAG_DEFINITIONS.map((flag) =>
    evaluateFlag(flag, { ...input, userId }),
  );

  return {
    flags,
    evaluatedAt: new Date().toISOString(),
  };
}
