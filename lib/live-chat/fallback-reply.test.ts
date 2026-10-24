import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LIVE_CHAT_BUY_HOWTO_REPLY,
  LIVE_CHAT_FEES_HOWTO_REPLY,
  LIVE_CHAT_MARKETPLACE_HOWTO_FALLBACK,
  LIVE_CHAT_ORDER_LOOKUP_FALLBACK,
  LIVE_CHAT_PRESENCE_REPLY,
  LIVE_CHAT_PROTECTION_HOWTO_REPLY,
  LIVE_CHAT_REFUND_POLICY_HOWTO_REPLY,
  LIVE_CHAT_SELL_HOWTO_REPLY,
  LIVE_CHAT_SELLER_PAYOUT_HOWTO_REPLY,
  LIVE_CHAT_SHIPPING_HOWTO_REPLY,
  resolveLiveChatFallbackReply,
} from "./fallback-reply.ts"
import {
  LIVE_CHAT_TOPIC_MENU_REPLY,
  isLiveChatCannedFailureReply,
} from "./live-chat-cs-prompt.ts"

describe("live chat fallback reply", () => {
  it("answers presence pings with a human hello — never a topic catalog", () => {
    for (const text of [
      "hi there",
      "hi there. anything there?",
      "you there?",
      "are you there?",
      "are you here?",
    ]) {
      assert.equal(resolveLiveChatFallbackReply(text), LIVE_CHAT_PRESENCE_REPLY, text)
    }
    assert.equal(LIVE_CHAT_PRESENCE_REPLY, "Yeah, I'm here — what's up?")
    assert.doesNotMatch(LIVE_CHAT_PRESENCE_REPLY, /buying, selling/i)
    assert.doesNotMatch(LIVE_CHAT_PRESENCE_REPLY, /Purchase Protection/)
    assert.doesNotMatch(LIVE_CHAT_PRESENCE_REPLY, /order number/i)
    assert.equal(isLiveChatCannedFailureReply(LIVE_CHAT_TOPIC_MENU_REPLY), true)
    assert.notEqual(resolveLiveChatFallbackReply("hi there. anything there?"), LIVE_CHAT_TOPIC_MENU_REPLY)
  })

  it("answers generic how-tos with published next steps", () => {
    assert.equal(
      resolveLiveChatFallbackReply("how do I buy a surfboard on Reswell?"),
      LIVE_CHAT_BUY_HOWTO_REPLY,
    )
    assert.equal(
      resolveLiveChatFallbackReply("hi there. i sold a board. how do i get my money?"),
      LIVE_CHAT_SELLER_PAYOUT_HOWTO_REPLY,
    )
    assert.doesNotMatch(LIVE_CHAT_SELLER_PAYOUT_HOWTO_REPLY, /order number/i)
    assert.equal(
      resolveLiveChatFallbackReply("how do I sell a board on Reswell?"),
      LIVE_CHAT_SELL_HOWTO_REPLY,
    )
    assert.equal(resolveLiveChatFallbackReply("how do I list something?"), LIVE_CHAT_SELL_HOWTO_REPLY)
    assert.equal(resolveLiveChatFallbackReply("how do fees work?"), LIVE_CHAT_FEES_HOWTO_REPLY)
    assert.equal(
      resolveLiveChatFallbackReply("how does shipping work?"),
      LIVE_CHAT_SHIPPING_HOWTO_REPLY,
    )
    assert.equal(
      resolveLiveChatFallbackReply("what's your refund policy?"),
      LIVE_CHAT_REFUND_POLICY_HOWTO_REPLY,
    )
    assert.equal(
      resolveLiveChatFallbackReply("what's your Purchase Protection coverage?"),
      LIVE_CHAT_PROTECTION_HOWTO_REPLY,
    )
    for (const reply of [
      LIVE_CHAT_SELL_HOWTO_REPLY,
      LIVE_CHAT_FEES_HOWTO_REPLY,
      LIVE_CHAT_SHIPPING_HOWTO_REPLY,
      LIVE_CHAT_REFUND_POLICY_HOWTO_REPLY,
      LIVE_CHAT_PROTECTION_HOWTO_REPLY,
      LIVE_CHAT_MARKETPLACE_HOWTO_FALLBACK,
    ]) {
      assert.notEqual(reply, LIVE_CHAT_PRESENCE_REPLY)
      assert.doesNotMatch(reply, /order number/i)
    }
  })

  it("asks which order for this-order lookups and named orders — not a menu", () => {
    assert.equal(resolveLiveChatFallbackReply("Where is my order?"), LIVE_CHAT_ORDER_LOOKUP_FALLBACK)
    assert.equal(resolveLiveChatFallbackReply("It's order #1042"), LIVE_CHAT_ORDER_LOOKUP_FALLBACK)
    assert.equal(resolveLiveChatFallbackReply("Where is order 1042?"), LIVE_CHAT_ORDER_LOOKUP_FALLBACK)
    assert.doesNotMatch(LIVE_CHAT_ORDER_LOOKUP_FALLBACK, /buying, selling/i)
    assert.equal(resolveLiveChatFallbackReply("can you look at this"), LIVE_CHAT_PRESENCE_REPLY)
  })
})
