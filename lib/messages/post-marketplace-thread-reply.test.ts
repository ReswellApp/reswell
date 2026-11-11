import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { postMarketplaceThreadReply } from "./post-marketplace-thread-reply.ts"

describe("postMarketplaceThreadReply", () => {
  it("reuses the in-flight request for the same client id", async () => {
    const originalFetch = globalThis.fetch
    let calls = 0
    let lastBody: unknown = null
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1
      lastBody = JSON.parse(String(init?.body ?? "{}"))
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
      assert.equal((lastBody as { client_id?: string }).client_id, "pending-same")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("retries once when the first fetch is aborted", async () => {
    const originalFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1
      if (calls === 1) {
        const error = new Error("The user aborted a request.")
        error.name = "AbortError"
        throw error
      }
      return new Response(
        JSON.stringify({
          success: true,
          message: {
            id: "msg-retry",
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
      const result = await postMarketplaceThreadReply({
        conversationId: "11111111-1111-4111-8111-111111111111",
        content: "hey",
        composerUnlockToken: "unlock-token-at-least-16",
        clientId: "pending-retry",
      })
      assert.equal(calls, 2)
      assert.equal("success" in result && result.success, true)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
