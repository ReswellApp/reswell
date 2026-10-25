import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LIVE_CHAT_BUY_HOWTO_REPLY,
  LIVE_CHAT_LOOK_INTO_IT_REPLY,
  LIVE_CHAT_ORDER_LOOKUP_FALLBACK,
  LIVE_CHAT_PRESENCE_REPLY,
  LIVE_CHAT_SELLER_PAYOUT_HOWTO_REPLY,
  isLiveChatGeneratedUngroundedReply,
  isLiveChatLookIntoItReply,
  liveChatLookIntoItInternalNote,
  resolveLiveChatFallbackReply,
  shouldCreateLiveChatLookIntoItFollowUp,
} from "./fallback-reply.ts"
import {
  LIVE_CHAT_TOPIC_MENU_REPLY,
  isLiveChatCannedFailureReply,
} from "./live-chat-cs-prompt.ts"

describe("live chat fallback reply", () => {
  it("answers presence pings with a human hello — never a topic catalog", () => {
    for (const text of ["hi there", "hi there. anything there?", "you there?"]) {
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
    assert.equal(shouldCreateLiveChatLookIntoItFollowUp(LIVE_CHAT_BUY_HOWTO_REPLY), false)
    assert.equal(shouldCreateLiveChatLookIntoItFollowUp(LIVE_CHAT_SELLER_PAYOUT_HOWTO_REPLY), false)
  })

  it("asks which order only for this-order lookups — not a menu", () => {
    assert.equal(resolveLiveChatFallbackReply("Where is my order?"), LIVE_CHAT_ORDER_LOOKUP_FALLBACK)
    assert.doesNotMatch(LIVE_CHAT_ORDER_LOOKUP_FALLBACK, /buying, selling/i)
    assert.equal(shouldCreateLiveChatLookIntoItFollowUp(LIVE_CHAT_ORDER_LOOKUP_FALLBACK), false)
  })

  it("promises a follow-up on unknown asks — never silence, a menu, or an order number", () => {
    assert.equal(
      resolveLiveChatFallbackReply("can you look at this"),
      LIVE_CHAT_LOOK_INTO_IT_REPLY,
    )
    assert.equal(
      resolveLiveChatFallbackReply("what's the story with your warehouse in portugal"),
      LIVE_CHAT_LOOK_INTO_IT_REPLY,
    )
    assert.equal(LIVE_CHAT_LOOK_INTO_IT_REPLY, "I'll look into it now and update you shortly.")
    assert.doesNotMatch(LIVE_CHAT_LOOK_INTO_IT_REPLY, /buying, selling/i)
    assert.doesNotMatch(LIVE_CHAT_LOOK_INTO_IT_REPLY, /order number/i)
    assert.doesNotMatch(LIVE_CHAT_LOOK_INTO_IT_REPLY, /support case/i)
    assert.equal(isLiveChatLookIntoItReply(LIVE_CHAT_LOOK_INTO_IT_REPLY), true)
    assert.equal(shouldCreateLiveChatLookIntoItFollowUp(LIVE_CHAT_LOOK_INTO_IT_REPLY), true)
    assert.equal(isLiveChatCannedFailureReply(LIVE_CHAT_LOOK_INTO_IT_REPLY), true)
    assert.notEqual(resolveLiveChatFallbackReply("can you look at this"), LIVE_CHAT_PRESENCE_REPLY)
    assert.notEqual(resolveLiveChatFallbackReply("can you look at this"), LIVE_CHAT_TOPIC_MENU_REPLY)
  })

  it("treats empty generate, topic menus, and order-number asks on unknown as ungrounded", () => {
    assert.equal(isLiveChatGeneratedUngroundedReply("", "can you look at this"), true)
    assert.equal(
      isLiveChatGeneratedUngroundedReply(LIVE_CHAT_LOOK_INTO_IT_REPLY, "can you look at this"),
      true,
    )
    assert.equal(
      isLiveChatGeneratedUngroundedReply(
        "What's the order number, and is it a purchase or a sale?",
        "can you look at this",
      ),
      true,
    )
    assert.equal(
      isLiveChatGeneratedUngroundedReply(LIVE_CHAT_ORDER_LOOKUP_FALLBACK, "Where is my order?"),
      false,
    )
    assert.equal(
      isLiveChatGeneratedUngroundedReply(LIVE_CHAT_BUY_HOWTO_REPLY, "how do I buy a surfboard?"),
      false,
    )
  })

  it("writes a staff-only follow-up note from the visitor ask", () => {
    const note = liveChatLookIntoItInternalNote("what's the story with your warehouse in portugal")
    assert.match(note, /Follow up in this chat/)
    assert.match(note, /warehouse in portugal/)
    assert.doesNotMatch(note, /opened a support case/i)
  })
})
