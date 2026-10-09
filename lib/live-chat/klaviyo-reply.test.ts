import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildLiveChatKlaviyoReplyPayload } from "./klaviyo-reply.ts"

describe("buildLiveChatKlaviyoReplyPayload", () => {
  const base = {
    visitorEmail: "guest@example.com",
    supportCaseId: "11111111-1111-4111-8111-111111111111",
    messageId: "22222222-2222-4222-8222-222222222222",
    content: "Browse /boards and check out through Reswell.",
    publicId: "lc_a1b2c3d4e5f67890",
    userId: null as string | null,
    origin: "https://www.reswell.app",
  }

  it("builds a Support Tickets Response payload that reopens the same chat", () => {
    const payload = buildLiveChatKlaviyoReplyPayload(base)
    assert.deepEqual(payload, {
      supportTicketId: "11111111-1111-4111-8111-111111111111",
      supportCaseId: "11111111-1111-4111-8111-111111111111",
      email: "guest@example.com",
      externalId: null,
      response: "Browse /boards and check out through Reswell.",
      responseType: "live_chat_reply",
      ticketUrl: "https://www.reswell.app/?chat=lc_a1b2c3d4e5f67890",
      uniqueId: "live-chat-reply-22222222-2222-4222-8222-222222222222",
    })
  })

  it("passes the signed-in member as Klaviyo external_id", () => {
    const payload = buildLiveChatKlaviyoReplyPayload({
      ...base,
      userId: "user-1",
    })
    assert.equal(payload?.externalId, "user-1")
  })

  it("emails a reopen ask instead of widget-only tap copy", () => {
    const payload = buildLiveChatKlaviyoReplyPayload({
      ...base,
      content: "Tap the order below and I'll look that one up.",
    })
    assert.ok(payload)
    assert.match(payload.response, /reopen the conversation/i)
    assert.doesNotMatch(payload.response, /tap the order below/i)
    assert.equal(payload.ticketUrl, "https://www.reswell.app/?chat=lc_a1b2c3d4e5f67890")
  })

  it("skips when email, body, case, message, or public id is missing", () => {
    assert.equal(buildLiveChatKlaviyoReplyPayload({ ...base, visitorEmail: null }), null)
    assert.equal(buildLiveChatKlaviyoReplyPayload({ ...base, content: "  " }), null)
    assert.equal(buildLiveChatKlaviyoReplyPayload({ ...base, supportCaseId: null }), null)
    assert.equal(buildLiveChatKlaviyoReplyPayload({ ...base, messageId: "" }), null)
    assert.equal(buildLiveChatKlaviyoReplyPayload({ ...base, publicId: "not-a-chat" }), null)
  })
})
