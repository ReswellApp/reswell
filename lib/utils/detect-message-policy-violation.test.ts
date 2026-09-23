import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { detectMessagePolicyViolation } from "./detect-message-policy-violation.ts"

describe("detectMessagePolicyViolation", () => {
  it("allows phone numbers while phone sharing policy is paused", () => {
    assert.equal(detectMessagePolicyViolation("call (949) 689-0987"), null)
    assert.equal(detectMessagePolicyViolation("949-689-0987 tonight"), null)
    assert.equal(detectMessagePolicyViolation("9496890987"), null)
  })

  it("still flags email, payment apps, and phishing", () => {
    assert.equal(detectMessagePolicyViolation("email me at seller@example.com"), "email_like")
    assert.equal(detectMessagePolicyViolation("venmo me the rest"), "off_platform_payment")
  })
})
