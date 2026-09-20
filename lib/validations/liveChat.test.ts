import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { regenerateLiveChatReplySchema, sendLiveChatVisitorMessageSchema } from "./liveChat.ts"

describe("sendLiveChatVisitorMessageSchema", () => {
  it("requires a composer unlock token", () => {
    const base = {
      visitor_token: "11111111-1111-4111-8111-111111111111",
      content: "hello",
    }
    assert.equal(sendLiveChatVisitorMessageSchema.safeParse(base).success, false)
    assert.equal(
      sendLiveChatVisitorMessageSchema.safeParse({
        ...base,
        composer_unlock_token: "a".repeat(20),
      }).success,
      true,
    )
  })
})

describe("regenerateLiveChatReplySchema", () => {
  it("accepts a re-roll with or without a rating note", () => {
    const base = {
      session_id: "11111111-1111-4111-8111-111111111111",
      message_id: "22222222-2222-4222-8222-222222222222",
    }
    assert.equal(regenerateLiveChatReplySchema.safeParse(base).success, true)
    assert.equal(
      regenerateLiveChatReplySchema.safeParse({
        ...base,
        rating: "bad",
        rating_note: "Ask what sort of issue is going on first.",
      }).success,
      true,
    )
  })
})
