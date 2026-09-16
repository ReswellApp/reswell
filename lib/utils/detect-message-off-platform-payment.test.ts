import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  messageContainsAmbiguousCashTerm,
  messageContainsNamedOffPlatformPaymentService,
  messageContainsOffPlatformPaymentTerms,
} from "./detect-message-off-platform-payment.ts"

describe("messageContainsOffPlatformPaymentTerms", () => {
  it("flags named off-platform apps including Cash App and Zelle", () => {
    assert.equal(messageContainsNamedOffPlatformPaymentService("venmo me"), true)
    assert.equal(messageContainsNamedOffPlatformPaymentService("Pay Pal works"), true)
    assert.equal(messageContainsNamedOffPlatformPaymentService("can you zelle?"), true)
    assert.equal(messageContainsNamedOffPlatformPaymentService("cashapp $surf"), true)
    assert.equal(messageContainsNamedOffPlatformPaymentService("use cash app"), true)
    assert.equal(messageContainsOffPlatformPaymentTerms("western union tonight"), true)
  })

  it("does not flag ordinary marketplace chat", () => {
    assert.equal(messageContainsOffPlatformPaymentTerms("Is this still available?"), false)
    assert.equal(messageContainsOffPlatformPaymentTerms("I can meet at the beach"), false)
  })

  it("ignores innocent cash pickup wording", () => {
    assert.equal(messageContainsAmbiguousCashTerm("I can do cash pickup Saturday"), false)
    assert.equal(messageContainsOffPlatformPaymentTerms("happy to pay in cash locally"), false)
    assert.equal(messageContainsOffPlatformPaymentTerms("cash on pickup is fine"), false)
  })

  it("flags isolated cash that is not clearly pickup language", () => {
    assert.equal(messageContainsAmbiguousCashTerm("just send cash"), true)
    assert.equal(messageContainsOffPlatformPaymentTerms("I need the cash first"), true)
  })
})
