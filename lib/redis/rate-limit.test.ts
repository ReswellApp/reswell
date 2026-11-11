import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  consumeRateLimit,
  rateLimitClientIp,
  resetMemoryRateLimits,
} from "./rate-limit.ts"

describe("redis rate limit", () => {
  it("reads the first forwarded IP", () => {
    const request = new Request("https://reswell.app/api/mobile/v1/search", {
      headers: {
        "x-forwarded-for": " 203.0.113.9, 10.0.0.1 ",
        "x-real-ip": "10.0.0.2",
      },
    })
    assert.equal(rateLimitClientIp(request), "203.0.113.9")
  })

  it("allows up to the limit then returns 429 metadata", async () => {
    resetMemoryRateLimits()
    const id = `test-${Date.now()}`
    const first = await consumeRateLimit({ scope: "test", id, limit: 2, windowMs: 60_000 })
    const second = await consumeRateLimit({ scope: "test", id, limit: 2, windowMs: 60_000 })
    const third = await consumeRateLimit({ scope: "test", id, limit: 2, windowMs: 60_000 })
    assert.equal(first.ok, true)
    assert.equal(first.remaining, 1)
    assert.equal(second.ok, true)
    assert.equal(second.remaining, 0)
    assert.equal(third.ok, false)
    if (!third.ok) {
      assert.equal(third.retryAfterSec >= 1, true)
    }
  })
})
