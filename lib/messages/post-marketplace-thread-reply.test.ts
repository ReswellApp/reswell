import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { postMarketplaceThreadReply } from "./post-marketplace-thread-reply.ts"

describe("postMarketplaceThreadReply", () => {
  it("reuses the in-flight request for the same client id", async () => {
    const originalFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = (async () => {
      calls += 1
      await new Promise((resolve) => setTimeout(resolve, 20))
      return new Response(
        JSON.stringify({
          success: true,
          message: {
            id: "msg-1",
            content: "hey",
            sender_id: "me",
            created_at: "2026-11-08T12:00:00.000Z",
            is_read: false,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }) as typeof fetch

    try {
      const input = {
        conversationId: "11111111-1111-4111-8111-111111111111",
        content: "hey",
        composerUnlockToken: "unlock-token-at-least-16",
        clientId: "pending-same",
      }
      const [first, second] = await Promise.all([
        postMarketplaceThreadReply(input),
        postMarketplaceThreadReply(input),
      ])
      assert.equal(calls, 1)
      assert.deepEqual(first, second)
      assert.equal("success" in first && first.success, true)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
