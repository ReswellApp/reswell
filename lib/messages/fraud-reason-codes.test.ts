import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { messagePolicyBlocksDelivery } from "./fraud-reason-codes.ts"

describe("messagePolicyBlocksDelivery", () => {
  it("blocks phone sharing and off-platform payment", () => {
    assert.equal(messagePolicyBlocksDelivery("phone_like"), true)
    assert.equal(messagePolicyBlocksDelivery("phone_fragment"), true)
    assert.equal(messagePolicyBlocksDelivery("off_platform_payment"), true)
    assert.equal(messagePolicyBlocksDelivery("email_like"), true)
  })
})
