/**
 * Feature Flag Service
 *
 * Full-featured flag evaluation engine with:
 * - Rule-based targeting with conditions and priorities
 * - Hash-based percentage rollouts (MurmurHash3)
 * - Semver comparison support
 * - Multi-level caching (all-flags + per-user)
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { featureFlags, featureFlagRules } from '../db/schema';
import {
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
} from '../lib/redis';
import { murmurhash3 } from '../lib/crypto';

// ── Types ───────────────────────────────────────────────────────────────────

export interface StoredFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  type: string | null;
  defaultValue: unknown;
  enabled: boolean | null;
  rules: StoredRule[];
}

export interface StoredRule {
  id: string;
  priority: number;
  conditions: FlagCondition[];
  value: unknown;
  rolloutPercentage: number | null;
}

export interface FlagCondition {
  field: string;
  operator:
    | 'eq'
    | 'neq'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'in'
    | 'not_in'
    | 'contains'
    | 'regex';
  value: unknown;
}

export interface FlagEvaluationContext {
  userId?: string;
  tier?: string;
  platform?: string;
  appVersion?: string;
  locale?: string;
  country?: string;
  deviceType?: string;
  [key: string]: unknown;
}

export interface FlagEvaluationResult {
  key: string;
  value: unknown;
  source: 'rule' | 'default' | 'disabled';
  ruleId?: string;
}

export interface BulkFlagEvaluationResponse {
  flags: Record<string, unknown>;
  details: FlagEvaluationResult[];
  evaluatedAt: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const ALL_FLAGS_CACHE_KEY = 'flags:all';
const ALL_FLAGS_CACHE_TTL = 300; // 5 minutes
const USER_FLAGS_CACHE_TTL = 60; // 1 minute

// ── Semver Helpers ──────────────────────────────────────────────────────────

interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Parse a semver string into its component parts.
 */
function parseSemver(version: string): SemverParts | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1]!, 10),
    minor: parseInt(match[2]!, 10),
    patch: parseInt(match[3]!, 10),
  };
}

/**
 * Compare two semver strings.
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b.
 */
function compareSemver(a: string, b: string): number {
  const aParts = parseSemver(a);
  const bParts = parseSemver(b);

  if (!aParts || !bParts) {
    // Fall back to string comparison
    return a < b ? -1 : a > b ? 1 : 0;
  }

  if (aParts.major !== bParts.major) return aParts.major < bParts.major ? -1 : 1;
  if (aParts.minor !== bParts.minor) return aParts.minor < bParts.minor ? -1 : 1;
  if (aParts.patch !== bParts.patch) return aParts.patch < bParts.patch ? -1 : 1;

  return 0;
}

// ── Condition Matching ──────────────────────────────────────────────────────

/**
 * Get a value from the evaluation context by dotted field path.
 */
function getContextValue(
  context: FlagEvaluationContext,
  field: string,
): unknown {
  const parts = field.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Check if a single condition matches against a context value.
 */
function matchesSingleCondition(
  contextValue: unknown,
  condition: FlagCondition,
): boolean {
  const { operator, value: conditionValue } = condition;

  // Handle null/undefined context values
  if (contextValue === undefined || contextValue === null) {
    if (operator === 'neq' || operator === 'not_in') return true;
    return false;
  }

  switch (operator) {
    case 'eq':
      return String(contextValue) === String(conditionValue);

    case 'neq':
      return String(contextValue) !== String(conditionValue);

    case 'gt': {
      // Try semver comparison first, then numeric, then string
      if (typeof contextValue === 'string' && typeof conditionValue === 'string') {
        const semResult = compareSemver(String(contextValue), String(conditionValue));
        if (parseSemver(String(contextValue)) && parseSemver(String(conditionValue))) {
          return semResult > 0;
        }
      }
      return Number(contextValue) > Number(conditionValue);
    }

    case 'gte': {
      if (typeof contextValue === 'string' && typeof conditionValue === 'string') {
        const semResult = compareSemver(String(contextValue), String(conditionValue));
        if (parseSemver(String(contextValue)) && parseSemver(String(conditionValue))) {
          return semResult >= 0;
        }
      }
      return Number(contextValue) >= Number(conditionValue);
    }

    case 'lt': {
      if (typeof contextValue === 'string' && typeof conditionValue === 'string') {
        const semResult = compareSemver(String(contextValue), String(conditionValue));
        if (parseSemver(String(contextValue)) && parseSemver(String(conditionValue))) {
          return semResult < 0;
        }
      }
      return Number(contextValue) < Number(conditionValue);
    }

    case 'lte': {
      if (typeof contextValue === 'string' && typeof conditionValue === 'string') {
        const semResult = compareSemver(String(contextValue), String(conditionValue));
        if (parseSemver(String(contextValue)) && parseSemver(String(conditionValue))) {
          return semResult <= 0;
        }
      }
      return Number(contextValue) <= Number(conditionValue);
    }

    case 'in': {
      if (!Array.isArray(conditionValue)) return false;
      return conditionValue.map(String).includes(String(contextValue));
    }

    case 'not_in': {
      if (!Array.isArray(conditionValue)) return true;
      return !conditionValue.map(String).includes(String(contextValue));
    }

    case 'contains': {
      return String(contextValue).includes(String(conditionValue));
    }

    case 'regex': {
      try {
        const regex = new RegExp(String(conditionValue));
        return regex.test(String(contextValue));
      } catch {
        return false;
      }
    }

    default:
      return false;
  }
}

/**
 * Check if all conditions match (AND logic).
 */
function matchesConditions(
  context: FlagEvaluationContext,
  conditions: FlagCondition[],
): boolean {
  if (!conditions || conditions.length === 0) return true;

  return conditions.every((condition) => {
    const contextValue = getContextValue(context, condition.field);
    return matchesSingleCondition(contextValue, condition);
  });
}

// ── Rollout Calculation ─────────────────────────────────────────────────────

/**
 * Calculate whether a user falls within a percentage rollout
 * using consistent hashing (MurmurHash3).
 */
function calculateRollout(
  flagKey: string,
  userId: string,
  percentage: number,
): boolean {
  if (percentage >= 100) return true;
  if (percentage <= 0) return false;

  const hashInput = `${flagKey}:${userId}`;
  const hash = murmurhash3(hashInput);
  const bucket = hash % 100; // 0-99

  return bucket < percentage;
}

// ── Flag Loading ────────────────────────────────────────────────────────────

/**
 * Load all flags from the database with their rules.
 * Results are cached in Redis for 5 minutes.
 */
async function loadAllFlags(): Promise<StoredFlag[]> {
  // Check cache first
  const cached = await getCache<StoredFlag[]>(ALL_FLAGS_CACHE_KEY);
  if (cached) return cached;

  // Load from database
  const flagRows = await db
    .select()
    .from(featureFlags);

  const ruleRows = await db
    .select()
    .from(featureFlagRules)
    .orderBy(featureFlagRules.priority);

  // Group rules by flag ID
  const rulesByFlagId = new Map<string, StoredRule[]>();
  for (const rule of ruleRows) {
    const flagId = rule.flagId;
    if (!rulesByFlagId.has(flagId)) {
      rulesByFlagId.set(flagId, []);
    }
    rulesByFlagId.get(flagId)!.push({
      id: rule.id,
      priority: rule.priority,
      conditions: (rule.conditions ?? []) as FlagCondition[],
      value: rule.value,
      rolloutPercentage: rule.rolloutPercentage,
    });
  }

  // Build stored flags
  const flags: StoredFlag[] = flagRows.map((flag) => ({
    id: flag.id,
    key: flag.key,
    name: flag.name,
    description: flag.description,
    type: flag.type,
    defaultValue: flag.defaultValue,
    enabled: flag.enabled,
    rules: rulesByFlagId.get(flag.id) ?? [],
  }));

  // Cache the result
  await setCache(ALL_FLAGS_CACHE_KEY, flags, ALL_FLAGS_CACHE_TTL);

  return flags;
}

// ── Single Flag Evaluation ──────────────────────────────────────────────────

/**
 * Evaluate a single flag against the given context.
 */
function evaluateSingleFlag(
  flag: StoredFlag,
  context: FlagEvaluationContext,
): FlagEvaluationResult {
  // If the flag is disabled, return default value
  if (!flag.enabled) {
    return {
      key: flag.key,
      value: flag.defaultValue,
      source: 'disabled',
    };
  }

  // Evaluate rules by priority (lower number = higher priority)
  const sortedRules = [...flag.rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    // Check if all conditions match
    if (!matchesConditions(context, rule.conditions)) {
      continue;
    }

    // Check rollout percentage if specified
    if (rule.rolloutPercentage !== null && rule.rolloutPercentage !== undefined) {
      const userId = context.userId ?? 'anonymous';
      if (!calculateRollout(flag.key, userId, rule.rolloutPercentage)) {
        continue;
      }
    }

    // Rule matched
    return {
      key: flag.key,
      value: rule.value,
      source: 'rule',
      ruleId: rule.id,
    };
  }

  // No rules matched, return default
  return {
    key: flag.key,
    value: flag.defaultValue,
    source: 'default',
  };
}

// ── Public Functions ────────────────────────────────────────────────────────

/**
 * Evaluate a single feature flag for a given context.
 */
export async function evaluateFlag(
  flagKey: string,
  context: FlagEvaluationContext,
): Promise<FlagEvaluationResult> {
  const allFlags = await loadAllFlags();
  const flag = allFlags.find((f) => f.key === flagKey);

  if (!flag) {
    return {
      key: flagKey,
      value: null,
      source: 'default',
    };
  }

  return evaluateSingleFlag(flag, context);
}

/**
 * Evaluate all feature flags for a given context.
 * Results are cached per-user for 1 minute.
 */
export async function evaluateAllFlags(
  context: FlagEvaluationContext,
): Promise<BulkFlagEvaluationResponse> {
  const userId = context.userId ?? 'anonymous';
  const userCacheKey = `flags:user:${userId}`;

  // Check per-user cache
  const cached = await getCache<BulkFlagEvaluationResponse>(userCacheKey);
  if (cached) return cached;

  const allFlags = await loadAllFlags();
  const details: FlagEvaluationResult[] = [];
  const flags: Record<string, unknown> = {};

  for (const flag of allFlags) {
    const result = evaluateSingleFlag(flag, context);
    details.push(result);
    flags[result.key] = result.value;
  }

  const response: BulkFlagEvaluationResponse = {
    flags,
    details,
    evaluatedAt: new Date().toISOString(),
  };

  // Cache per-user result
  await setCache(userCacheKey, response, USER_FLAGS_CACHE_TTL);

  return response;
}

/**
 * Invalidate all flag caches. Called when flags are updated via admin.
 */
export async function invalidateFlagCaches(): Promise<void> {
  await deleteCache(ALL_FLAGS_CACHE_KEY);
  await deleteCachePattern('flags:user:*');
}

/**
 * Invalidate flag cache for a specific user.
 */
export async function invalidateUserFlagCache(userId: string): Promise<void> {
  await deleteCache(`flags:user:${userId}`);
}

/**
 * Preview flag evaluation without caching.
 * Used by admin tools to test flag configurations.
 */
export async function previewFlagEvaluation(
  flagKey: string,
  context: FlagEvaluationContext,
): Promise<FlagEvaluationResult & { flag: StoredFlag | null }> {
  const allFlags = await loadAllFlags();
  const flag = allFlags.find((f) => f.key === flagKey) ?? null;

  if (!flag) {
    return {
      key: flagKey,
      value: null,
      source: 'default',
      flag: null,
    };
  }

  const result = evaluateSingleFlag(flag, context);
  return { ...result, flag };
}
