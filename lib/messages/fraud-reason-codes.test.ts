import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  messagePolicyBlocksDelivery,
  messagePolicyCountsTowardPhishingBan,
} from "./fraud-reason-codes.ts"

describe("messagePolicyBlocksDelivery", () => {
  it("blocks phone sharing and off-platform payment", () => {
    assert.equal(messagePolicyBlocksDelivery("phone_like"), true)
    assert.equal(messagePolicyBlocksDelivery("phone_fragment"), true)
    assert.equal(messagePolicyBlocksDelivery("off_platform_payment"), true)
    assert.equal(messagePolicyBlocksDelivery("email_like"), true)
  })

  it("does not treat accidental contact sharing as a ban strike", () => {
    assert.equal(messagePolicyCountsTowardPhishingBan("phishing_like"), true)
    assert.equal(messagePolicyCountsTowardPhishingBan("phone_like"), false)
    assert.equal(messagePolicyCountsTowardPhishingBan("off_platform_payment"), false)
  })
})
