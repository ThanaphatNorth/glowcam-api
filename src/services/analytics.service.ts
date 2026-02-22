/**
 * Analytics Service
 *
 * Event ingestion with batch insert support, validation,
 * and event count queries for analytics dashboards.
 */

import { sql, and, gte, lte, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { analyticsEvents } from '../db/schema';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AnalyticsEvent {
  userId?: string;
  deviceId?: string;
  eventType: string;
  properties?: Record<string, unknown>;
  sessionId?: string;
  platform?: 'ios' | 'android' | 'web';
  appVersion?: string;
  timestamp?: string; // ISO 8601
}

export interface IngestResult {
  ingested: number;
  errors: { index: number; message: string }[];
}

export interface EventCountInput {
  eventType?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}

// ── Constants ───────────────────────────────────────────────────────────────

const MAX_BATCH_SIZE = 100;
const MAX_EVENT_TYPE_LENGTH = 100;
const MAX_PROPERTIES_SIZE = 4096; // bytes

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validate a single analytics event.
 * Returns an error message if invalid, null if valid.
 */
function validateEvent(event: AnalyticsEvent): string | null {
  if (!event.eventType) {
    return 'eventType is required';
  }

  if (event.eventType.length > MAX_EVENT_TYPE_LENGTH) {
    return `eventType exceeds max length of ${MAX_EVENT_TYPE_LENGTH} characters`;
  }

  if (event.properties) {
    const propsString = JSON.stringify(event.properties);
    if (Buffer.byteLength(propsString, 'utf-8') > MAX_PROPERTIES_SIZE) {
      return `properties exceeds max size of ${MAX_PROPERTIES_SIZE} bytes`;
    }
  }

  if (event.timestamp) {
    const date = new Date(event.timestamp);
    if (isNaN(date.getTime())) {
      return 'timestamp is not a valid ISO 8601 date';
    }
  }

  if (event.platform && !['ios', 'android', 'web'].includes(event.platform)) {
    return `invalid platform: ${event.platform}`;
  }

  return null;
}

// ── Public Functions ────────────────────────────────────────────────────────

/**
 * Ingest a batch of analytics events.
 * Validates each event individually and inserts valid ones.
 */
export async function ingestEvents(
  events: AnalyticsEvent[],
): Promise<IngestResult> {
  if (events.length === 0) {
    return { ingested: 0, errors: [] };
  }

  if (events.length > MAX_BATCH_SIZE) {
    throw new Error(
      `Batch size ${events.length} exceeds maximum of ${MAX_BATCH_SIZE} events`,
    );
  }

  const errors: { index: number; message: string }[] = [];
  const validEvents: {
    userId: string | null;
    deviceId: string | null;
    eventType: string;
    properties: Record<string, unknown>;
    sessionId: string | null;
    platform: 'ios' | 'android' | 'web' | null;
    appVersion: string | null;
    timestamp: Date;
  }[] = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    const error = validateEvent(event);

    if (error) {
      errors.push({ index: i, message: error });
      continue;
    }

    validEvents.push({
      userId: event.userId ?? null,
      deviceId: event.deviceId ?? null,
      eventType: event.eventType,
      properties: event.properties ?? {},
      sessionId: event.sessionId ?? null,
      platform: event.platform ?? null,
      appVersion: event.appVersion ?? null,
      timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
    });
  }

  if (validEvents.length > 0) {
    await db.insert(analyticsEvents).values(validEvents);
  }

  return {
    ingested: validEvents.length,
    errors,
  };
}

/**
 * Get event counts with optional filters.
 */
export async function getEventCount(
  input: EventCountInput = {},
): Promise<number> {
  const { eventType, userId, startDate, endDate } = input;

  const conditions = [];

  if (eventType) {
    conditions.push(eq(analyticsEvents.eventType, eventType));
  }

  if (userId) {
    conditions.push(eq(analyticsEvents.userId, userId));
  }

  if (startDate) {
    conditions.push(gte(analyticsEvents.timestamp, startDate));
  }

  if (endDate) {
    conditions.push(lte(analyticsEvents.timestamp, endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(analyticsEvents)
    .where(whereClause);

  return result?.count ?? 0;
}
