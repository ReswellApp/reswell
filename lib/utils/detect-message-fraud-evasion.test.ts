import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { messageLooksLikeFraudEvasion } from "./detect-message-fraud-evasion.ts"

describe("messageLooksLikeFraudEvasion", () => {
  it("flags contact-channel and digit-sharing workarounds", () => {
    assert.equal(messageLooksLikeFraudEvasion("text me later"), true)
    assert.equal(messageLooksLikeFraudEvasion("whatsapp me tonight"), true)
    assert.equal(messageLooksLikeFraudEvasion("here is my number"), true)
    assert.equal(messageLooksLikeFraudEvasion("five five five one two"), true)
    assert.equal(messageLooksLikeFraudEvasion("v3nmo me"), true)
    assert.equal(messageLooksLikeFraudEvasion("v e n m o"), true)
    assert.equal(messageLooksLikeFraudEvasion("send it to $surfbuyer"), true)
  })

  it("does not flag ordinary listing chat", () => {
    assert.equal(messageLooksLikeFraudEvasion("Is this still available?"), false)
    assert.equal(messageLooksLikeFraudEvasion("I can meet Saturday morning"), false)
    assert.equal(messageLooksLikeFraudEvasion("The board is 5'10 19 2 1/4"), false)
  })

  it("ignores phone contact while phone sharing is allowed", () => {
    const options = { ignorePhoneContact: true }
    assert.equal(messageLooksLikeFraudEvasion("text me at 949-689-0987", options), false)
    assert.equal(messageLooksLikeFraudEvasion("here is my number", options), false)
    assert.equal(messageLooksLikeFraudEvasion("five five five one two", options), false)
    assert.equal(messageLooksLikeFraudEvasion("v3nmo me", options), true)
    assert.equal(messageLooksLikeFraudEvasion("send it to $surfbuyer", options), true)
  })
})
