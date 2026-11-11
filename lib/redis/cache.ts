import { getRedis } from "@/lib/redis/client"

type CacheEnvelope<T> = { v: T }

function isCacheEnvelope(value: unknown): value is CacheEnvelope<unknown> {
  return value != null && typeof value === "object" && "v" in value
}

function stringifyEnvelope<T>(value: T): string {
  return JSON.stringify({ v: value } satisfies CacheEnvelope<T>)
}

function parseEnvelope<T>(raw: string | null): T | undefined {
  if (!raw) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isCacheEnvelope(parsed)) return parsed.v as T
  } catch {
    return undefined
  }
  return undefined
}

function logRedisCacheError(op: "get" | "set" | "del", key: string, error: unknown): void {
  console.error("[redis] cache failed", {
    op,
    key,
    timestamp: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
  })
}

/**
 * Shared get-or-set. Misses (and Redis outages) run `loader`.
 * Values are wrapped so a cached `null` is not treated as a miss.
 */
export async function redisGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
  options?: { cacheIf?: (value: T) => boolean },
): Promise<T> {
  const redis = getRedis()
  if (redis) {
    try {
      const hit = parseEnvelope<T>(await redis.get(key))
      if (hit !== undefined) return hit
    } catch (error) {
      logRedisCacheError("get", key, error)
    }
  }

  const value = await loader()
  const shouldCache = options?.cacheIf ? options.cacheIf(value) : true
  if (redis && shouldCache) {
    try {
      await redis.set(key, stringifyEnvelope(value), { ex: ttlSeconds })
    } catch (error) {
      logRedisCacheError("set", key, error)
    }
  }
  return value
}

export async function redisSetJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(key, stringifyEnvelope(value), { ex: ttlSeconds })
  } catch (error) {
    logRedisCacheError("set", key, error)
  }
}

export async function redisDel(keys: readonly string[]): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  const unique = [...new Set(keys.map((key) => key.trim()).filter(Boolean))]
  if (unique.length === 0) return
  try {
    await redis.del(...unique)
  } catch (error) {
    logRedisCacheError("del", unique.join(","), error)
  }
}
