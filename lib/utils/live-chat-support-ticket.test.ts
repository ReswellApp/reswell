import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  DEFAULT_LIVE_CHAT_REPLY_PROMPT,
  LIVE_CHAT_SELLER_PAYOUT_HOWTO_REPLY,
  LIVE_CHAT_UNGROUNDED_REPLY,
  resolveLiveChatFallbackReply,
} from "../live-chat/live-chat-cs-prompt.ts"
import {
  liveChatVisitorMatchesOpenCase,
  shouldHonorLiveChatTicketClose,
} from "./live-chat-support-ticket.ts"

describe("liveChatVisitorMatchesOpenCase", () => {
  const open = {
    source_channel: "live_chat",
    status: "in_progress",
    requester_user_id: "user-1",
    requester_email: "hayden@example.com",
  }

  it("reuses the open live-chat ticket for the same member", () => {
    assert.equal(liveChatVisitorMatchesOpenCase({ userId: "user-1" }, open), true)
  })

  it("reuses the open live-chat ticket for the same email", () => {
    assert.equal(
      liveChatVisitorMatchesOpenCase({ email: "Hayden@example.com" }, open),
      true,
    )
  })

  it("does not reuse a resolved ticket or a different channel", () => {
    assert.equal(
      liveChatVisitorMatchesOpenCase({ userId: "user-1" }, { ...open, status: "resolved" }),
      false,
    )
    assert.equal(
      liveChatVisitorMatchesOpenCase(
        { userId: "user-1" },
        { ...open, source_channel: "contact_form" },
      ),
      false,
    )
  })

  it("does not reuse another visitor's ticket", () => {
    assert.equal(
      liveChatVisitorMatchesOpenCase({ userId: "user-2", email: "other@example.com" }, open),
      false,
    )
  })
})

describe("shouldHonorLiveChatTicketClose", () => {
  const solved = {
    closeTicket: true,
    reply: "Your tracking is moving again — you are all set. Start a new chat if anything else comes up.",
    lastCustomerMessage: "Thanks, that is all I needed.",
    needsHumanReview: false,
  }

  it("closes when the model says solved and the reply is a finished answer", () => {
    assert.equal(shouldHonorLiveChatTicketClose(solved), true)
  })

  it("stays open when the model asked a question or is still investigating", () => {
    assert.equal(
      shouldHonorLiveChatTicketClose({ ...solved, reply: "Can you share the order number?" }),
      false,
    )
    assert.equal(
      shouldHonorLiveChatTicketClose({
        ...solved,
        reply: "Thanks for writing in — we're looking into this and will follow up here shortly.",
      }),
      false,
    )
  })

  it("stays open on a greeting-only first message or when review is required", () => {
    assert.equal(
      shouldHonorLiveChatTicketClose({ ...solved, lastCustomerMessage: "Hi!" }),
      false,
    )
    assert.equal(shouldHonorLiveChatTicketClose({ ...solved, needsHumanReview: true }), false)
    assert.equal(shouldHonorLiveChatTicketClose({ ...solved, closeTicket: false }), false)
  })
})

describe("live chat CS prompt", () => {
  it("documents close_ticket in the editable live-chat prompt", () => {
    assert.match(DEFAULT_LIVE_CHAT_REPLY_PROMPT, /close_ticket true only when/)
    assert.match(DEFAULT_LIVE_CHAT_REPLY_PROMPT, /only open live-chat ticket/)
    assert.match(DEFAULT_LIVE_CHAT_REPLY_PROMPT, /account snapshot/i)
    assert.match(DEFAULT_LIVE_CHAT_REPLY_PROMPT, /very_good/)
    assert.match(DEFAULT_LIVE_CHAT_REPLY_PROMPT, /Hayden or David/)
    assert.match(DEFAULT_LIVE_CHAT_REPLY_PROMPT, /How-tos vs lookups/)
    assert.match(DEFAULT_LIVE_CHAT_REPLY_PROMPT, /how do I get my money/)
    assert.doesNotMatch(DEFAULT_LIVE_CHAT_REPLY_PROMPT, /You are Reswell Team/)
    assert.doesNotMatch(DEFAULT_LIVE_CHAT_REPLY_PROMPT, /what's the order number/)
  })

  it("asks one question instead of pretending the team is already investigating", () => {
    assert.match(LIVE_CHAT_UNGROUNDED_REPLY, /\?/)
    assert.doesNotMatch(LIVE_CHAT_UNGROUNDED_REPLY, /order number/)
    assert.equal(
      shouldHonorLiveChatTicketClose({
        closeTicket: true,
        reply: LIVE_CHAT_UNGROUNDED_REPLY,
        lastCustomerMessage: "Where is my board?",
        needsHumanReview: false,
      }),
      false,
    )
  })

  it("answers seller payout how-tos without asking for an order number", () => {
    const reply = resolveLiveChatFallbackReply("hi there. i sold a board. how do i get my money?")
    assert.equal(reply, LIVE_CHAT_SELLER_PAYOUT_HOWTO_REPLY)
    assert.match(reply, /earnings/i)
    assert.match(reply, /dashboard\/earnings/)
    assert.doesNotMatch(reply, /order number/i)
    assert.doesNotMatch(reply, /\$\d/)
    assert.equal(
      resolveLiveChatFallbackReply("where is my board?"),
      LIVE_CHAT_UNGROUNDED_REPLY,
    )
  })
})
