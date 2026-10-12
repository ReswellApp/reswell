import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  MARKETPLACE_THREAD_MESSAGE_EVENT,
  marketplaceThreadBroadcastHttpRequest,
  marketplaceThreadChannel,
  marketplaceThreadMessageFromRow,
} from "./thread-broadcast"

describe("marketplaceThreadBroadcastHttpRequest", () => {
  it("posts a private message event on the conversation channel", () => {
    const payload = {
      id: "11111111-1111-4111-8111-111111111111",
      conversation_id: "22222222-2222-4222-8222-222222222222",
      sender_id: "33333333-3333-4333-8333-333333333333",
      content: "Is this still available?",
      created_at: "2026-10-12T16:00:00.000Z",
      is_read: false,
      offer_id: null,
    }

    const request = marketplaceThreadBroadcastHttpRequest({
      supabaseUrl: "https://example.supabase.co/",
      conversationId: payload.conversation_id,
      event: MARKETPLACE_THREAD_MESSAGE_EVENT,
      payload,
    })

    assert.equal(request.url, "https://example.supabase.co/realtime/v1/api/broadcast")
    assert.deepEqual(request.body.messages, [
      {
        topic: marketplaceThreadChannel(payload.conversation_id),
        event: MARKETPLACE_THREAD_MESSAGE_EVENT,
        payload,
        private: true,
      },
    ])
  })
})

describe("marketplaceThreadMessageFromRow", () => {
  it("fills conversation_id from the caller when the row omits it", () => {
    const message = marketplaceThreadMessageFromRow(
      {
        id: "11111111-1111-4111-8111-111111111111",
        sender_id: "33333333-3333-4333-8333-333333333333",
        content: "hello",
        created_at: "2026-10-12T16:00:00.000Z",
      },
      "22222222-2222-4222-8222-222222222222",
    )

    assert.equal(message?.conversation_id, "22222222-2222-4222-8222-222222222222")
    assert.equal(message?.content, "hello")
  })

  it("drops a row that has no id", () => {
    assert.equal(
      marketplaceThreadMessageFromRow(
        {
          sender_id: "33333333-3333-4333-8333-333333333333",
          content: "hello",
          created_at: "2026-10-12T16:00:00.000Z",
        },
        "22222222-2222-4222-8222-222222222222",
      ),
      null,
    )
  })
})
