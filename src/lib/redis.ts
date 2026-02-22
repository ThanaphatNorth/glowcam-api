import Redis from 'ioredis';

// -- Singleton Client --------------------------------------------------------

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
      keepAlive: 30000,
      retryStrategy(times) {
        if (times > 10) {
          return null;
        }
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
    });

    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    redis.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    redis.on('reconnecting', () => {
      console.log('[Redis] Reconnecting...');
    });
  }
  return redis;
}

// -- Convenience helpers -----------------------------------------------------

/**
 * Get a cached value by key. Returns null if the key does not exist.
 * Attempts to parse JSON; returns raw string on parse failure.
 */
export async function getCache<T = string>(key: string): Promise<T | null> {
  const raw = await getRedis().get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

/**
 * Set a cached value with an optional TTL in seconds.
 */
export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<void> {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);

  if (ttlSeconds !== undefined && ttlSeconds > 0) {
    await getRedis().set(key, serialized, 'EX', ttlSeconds);
  } else {
    await getRedis().set(key, serialized);
  }
}

/**
 * Delete a cached value by key.
 */
export async function deleteCache(key: string): Promise<void> {
  await getRedis().del(key);
}

/**
 * Increment a counter with expiry. Useful for rate limiting.
 * Returns the new count after increment.
 * On the first call (when the key is created), the TTL is set.
 */
export async function incrementWithExpiry(
  key: string,
  ttlSeconds: number,
): Promise<number> {
  const r = getRedis();

  const pipeline = r.pipeline();
  pipeline.incr(key);
  pipeline.ttl(key);

  const results = await pipeline.exec();

  if (!results) {
    throw new Error('Redis pipeline execution failed');
  }

  const [incrResult, ttlResult] = results;
  const count = incrResult?.[1] as number;
  const currentTtl = ttlResult?.[1] as number;

  // If the key was just created (count === 1) or has no TTL set (-1),
  // set the expiry
  if (count === 1 || currentTtl === -1) {
    await r.expire(key, ttlSeconds);
  }

  return count;
}

/**
 * Delete multiple keys matching a pattern. Use with caution in production.
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  const client = getRedis();
  let cursor = '0';
  let deletedCount = 0;

  do {
    const [nextCursor, keys] = await client.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      100,
    );
    cursor = nextCursor;

    if (keys.length > 0) {
      await client.del(...keys);
      deletedCount += keys.length;
    }
  } while (cursor !== '0');

  return deletedCount;
}

/**
 * Gracefully close the Redis connection.
 */
export async function closeRedisConnection(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
