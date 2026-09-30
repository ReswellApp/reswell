import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isCronRequestAuthorized } from "./cron-auth.ts"

function request(authorization?: string): Request {
  return new Request("https://reswell.app/api/cron/test", {
    headers: authorization ? { authorization } : undefined,
  })
}

describe("isCronRequestAuthorized", () => {
  it("accepts the configured Bearer token", () => {
    assert.equal(isCronRequestAuthorized(request("Bearer cron-secret"), "cron-secret"), true)
  })

  it("rejects missing, malformed, and incorrect credentials", () => {
    assert.equal(isCronRequestAuthorized(request(), "cron-secret"), false)
    assert.equal(isCronRequestAuthorized(request("Basic cron-secret"), "cron-secret"), false)
    assert.equal(isCronRequestAuthorized(request("Bearer wrong-secret"), "cron-secret"), false)
  })

  it("fails closed when the cron secret is not configured", () => {
    assert.equal(isCronRequestAuthorized(request("Bearer cron-secret"), undefined), false)
    assert.equal(isCronRequestAuthorized(request("Bearer cron-secret"), "  "), false)
  })
})
