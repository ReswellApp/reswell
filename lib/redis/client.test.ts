import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getRedis, isRedisConfigured, resetRedisClient } from "./client.ts"

describe("redis client", () => {
  it("stays unconfigured when REDIS_URL is missing", () => {
    const redisUrl = process.env.REDIS_URL
    const mesaUrl = process.env.mesa_REDIS_URL
    delete process.env.REDIS_URL
    delete process.env.mesa_REDIS_URL
    resetRedisClient()
    try {
      assert.equal(isRedisConfigured(), false)
      assert.equal(getRedis(), null)
    } finally {
      if (redisUrl) process.env.REDIS_URL = redisUrl
      if (mesaUrl) process.env.mesa_REDIS_URL = mesaUrl
      resetRedisClient()
    }
  })
})
