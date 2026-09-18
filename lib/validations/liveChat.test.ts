import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { sendLiveChatVisitorMessageSchema } from "./liveChat.ts"

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
