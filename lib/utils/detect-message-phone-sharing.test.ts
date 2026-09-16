import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { messageAppearsToSharePhoneNumber } from "./detect-message-phone-sharing.ts"

describe("messageAppearsToSharePhoneNumber", () => {
  it("flags grouped, isolated, and spelled NANP numbers", () => {
    assert.equal(messageAppearsToSharePhoneNumber("call (949) 689-0987"), true)
    assert.equal(messageAppearsToSharePhoneNumber("949-689-0987 tonight"), true)
    assert.equal(messageAppearsToSharePhoneNumber("9496890987"), true)
    assert.equal(messageAppearsToSharePhoneNumber("eight zero five four five four nine four zero six"), true)
  })

  it("does not flag board dimensions or ordinary chat", () => {
    assert.equal(messageAppearsToSharePhoneNumber("Is this still available?"), false)
    assert.equal(messageAppearsToSharePhoneNumber("It's 5'10 19 2 1/4"), false)
    assert.equal(messageAppearsToSharePhoneNumber("Asking $650"), false)
  })
})
