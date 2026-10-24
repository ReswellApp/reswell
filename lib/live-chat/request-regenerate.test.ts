import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { requestLiveChatReplyRegenerate } from "./request-regenerate.ts"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("requestLiveChatReplyRegenerate", () => {
  it("returns an error object when fetch throws", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch")
    }) as typeof fetch

    const result = await requestLiveChatReplyRegenerate({
      sessionId: "sess",
      messageId: "msg",
    })
    assert.deepEqual(result, { error: "Could not regenerate that reply." })
  })
})
