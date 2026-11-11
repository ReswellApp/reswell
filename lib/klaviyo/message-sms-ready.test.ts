import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isMessageSmsReady } from "@/lib/klaviyo/message-sms-ready"

describe("isMessageSmsReady", () => {
  it("requires both opt-in and a phone", () => {
    assert.equal(isMessageSmsReady({ optedIn: true, phoneE164: "+15551234567" }), true)
    assert.equal(isMessageSmsReady({ optedIn: true, phoneE164: null }), false)
    assert.equal(isMessageSmsReady({ optedIn: true, phoneE164: "  " }), false)
    assert.equal(isMessageSmsReady({ optedIn: false, phoneE164: "+15551234567" }), false)
  })
})
