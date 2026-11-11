import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { redisGetOrSet } from "./cache.ts"
import { resetRedisClient } from "./client.ts"

describe("redisGetOrSet", () => {
  it("runs the loader when Redis is not configured", async () => {
    resetRedisClient()
    let loads = 0
    const first = await redisGetOrSet("cache:test:unused", 30, async () => {
      loads += 1
      return { listings: [] }
    })
    const second = await redisGetOrSet("cache:test:unused", 30, async () => {
      loads += 1
      return { listings: [] }
    })
    assert.deepEqual(first, { listings: [] })
    assert.deepEqual(second, { listings: [] })
    assert.equal(loads, 2)
  })

  it("skips set when cacheIf rejects the value", async () => {
    let loads = 0
    const result = await redisGetOrSet(
      "cache:test:skip",
      30,
      async () => {
        loads += 1
        return { ok: false as const }
      },
      { cacheIf: (value) => value.ok },
    )
    assert.equal(result.ok, false)
    assert.equal(loads, 1)
  })
})
