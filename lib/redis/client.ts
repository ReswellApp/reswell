import Redis from "ioredis"

export interface RedisCommands {
  get(key: string): Promise<string | null>
  set(key: string, value: string, options: { ex: number }): Promise<unknown>
  del(...keys: string[]): Promise<unknown>
  eval(script: string, keys: string[], args: string[]): Promise<unknown>
}

let connection: Redis | null | undefined
let commands: RedisCommands | null | undefined

function redisUrl(): string {
  return (
    process.env.REDIS_URL?.trim() ||
    process.env.mesa_REDIS_URL?.trim() ||
    ""
  )
}

function wrap(redis: Redis): RedisCommands {
  return {
    get: (key) => redis.get(key),
    set: (key, value, options) => redis.set(key, value, "EX", options.ex),
    del: (...keys) => redis.del(...keys),
    eval: (script, keys, args) => redis.eval(script, keys.length, ...keys, ...args),
  }
}

/** True when a Redis connection string is present (Vercel Redis / Redis Cloud). */
export function isRedisConfigured(): boolean {
  return Boolean(redisUrl())
}

/**
 * Shared Redis client. Returns null when env is missing so local and CI
 * keep working without Redis. Uses the TCP URL from the linked store.
 */
export function getRedis(): RedisCommands | null {
  if (commands !== undefined) return commands
  const url = redisUrl()
  if (!url) {
    connection = null
    commands = null
    return null
  }

  const redis = new Redis(url, {
    maxRetriesPerRequest: 2,
    connectTimeout: 5_000,
    lazyConnect: true,
    enableOfflineQueue: true,
    enableReadyCheck: true,
  })
  redis.on("error", (error: Error) => {
    console.error("[redis] connection failed", {
      timestamp: new Date().toISOString(),
      message: error.message,
    })
  })
  connection = redis
  commands = wrap(redis)
  return commands
}

/** Clears the process-local client. Used by tests. */
export function resetRedisClient(): void {
  if (connection) {
    connection.removeAllListeners()
    void connection.quit().catch(() => undefined)
  }
  connection = undefined
  commands = undefined
}
