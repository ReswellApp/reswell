import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  firstForwardedIp,
  hashAccessSignal,
  isBannablePublicIp,
  isSignupPath,
  isValidDeviceId,
  normalizeClientIp,
} from "./access-signals.ts"

describe("access signals", () => {
  it("accepts a UUID device id and rejects junk", () => {
    assert.equal(isValidDeviceId("2c1d3e4f-5a6b-4789-a012-3456789abcde"), true)
    assert.equal(isValidDeviceId("not-a-uuid"), false)
    assert.equal(isValidDeviceId(""), false)
    assert.equal(isValidDeviceId(null), false)
  })

  it("normalizes forwarded IPs and skips private / loopback", () => {
    assert.equal(firstForwardedIp("203.0.113.10, 10.0.0.1"), "203.0.113.10")
    assert.equal(normalizeClientIp("::ffff:203.0.113.10"), "203.0.113.10")
    assert.equal(normalizeClientIp("203.0.113.10:443"), "203.0.113.10")
    assert.equal(isBannablePublicIp("203.0.113.10"), true)
    assert.equal(isBannablePublicIp("127.0.0.1"), false)
    assert.equal(isBannablePublicIp("10.0.0.8"), false)
    assert.equal(isBannablePublicIp("192.168.1.20"), false)
    assert.equal(isBannablePublicIp("172.16.0.2"), false)
  })

  it("hashes the same value to the same digest", async () => {
    const a = await hashAccessSignal("203.0.113.10")
    const b = await hashAccessSignal("203.0.113.10")
    const c = await hashAccessSignal("203.0.113.11")
    assert.equal(a, b)
    assert.notEqual(a, c)
    assert.equal(a.length, 64)
  })

  it("recognizes sign-up paths", () => {
    assert.equal(isSignupPath("/auth/sign-up"), true)
    assert.equal(isSignupPath("/auth/sign-up/"), true)
    assert.equal(isSignupPath("/auth/login"), false)
  })
})
