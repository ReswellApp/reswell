import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { LIVE_CHAT_UNGROUNDED_REPLY } from "./live-chat-cs-prompt.ts"
import {
  LIVE_CHAT_LABEL_UPDATE_REPLY,
  LIVE_CHAT_ORDER_TILE_REPLY,
  liveChatCsAgentCatchFallback,
} from "./auto-reply-fallback.ts"

describe("liveChatCsAgentCatchFallback", () => {
  it("points label-update asks at the ship-from tiles", () => {
    assert.equal(
      liveChatCsAgentCatchFallback("I need to update my shipping label"),
      LIVE_CHAT_LABEL_UPDATE_REPLY,
    )
  })

  it("points this-order lookups at the tap-to-pick tiles", () => {
    assert.equal(
      liveChatCsAgentCatchFallback("Where is my order?"),
      LIVE_CHAT_ORDER_TILE_REPLY,
    )
    assert.equal(
      liveChatCsAgentCatchFallback("Can you check tracking on my package?"),
      LIVE_CHAT_ORDER_TILE_REPLY,
    )
    assert.equal(
      liveChatCsAgentCatchFallback("I want a refund"),
      LIVE_CHAT_ORDER_TILE_REPLY,
    )
  })

  it("keeps the ungrounded ask for everything else", () => {
    assert.equal(liveChatCsAgentCatchFallback("How do I sell a board?"), LIVE_CHAT_UNGROUNDED_REPLY)
    assert.equal(
      liveChatCsAgentCatchFallback("hi there. i sold a board. how do i get my money?"),
      LIVE_CHAT_UNGROUNDED_REPLY,
    )
  })
})
