import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  isOpenSupportCaseLimitReached,
  MAX_OPEN_USER_SUPPORT_CASES,
} from "./support-case-open-limit.ts"
import { isLiveChatSupportChannel } from "./support-ticket-display.ts"

describe("isOpenSupportCaseLimitReached", () => {
  it("allows four open requests", () => {
    assert.equal(isOpenSupportCaseLimitReached(4), false)
  })

  it("blocks at five open requests", () => {
    assert.equal(isOpenSupportCaseLimitReached(MAX_OPEN_USER_SUPPORT_CASES), true)
    assert.equal(isOpenSupportCaseLimitReached(6), true)
  })
})

describe("isLiveChatSupportChannel", () => {
  it("keeps live chat out of the member /support lists", () => {
    assert.equal(isLiveChatSupportChannel("live_chat"), true)
    assert.equal(isLiveChatSupportChannel("help_hub"), false)
    assert.equal(isLiveChatSupportChannel("contact_form"), false)
  })
})
