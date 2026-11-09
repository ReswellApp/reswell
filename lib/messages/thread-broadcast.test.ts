import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  MARKETPLACE_THREAD_MESSAGE_EVENT,
  marketplaceInboxChannel,
  marketplaceInsertedMessageBroadcasts,
  marketplaceThreadBroadcastHttpRequest,
  marketplaceThreadChannel,
  marketplaceThreadMessageFromRow,
  marketplaceThreadRefreshBroadcasts,
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

describe("marketplaceInsertedMessageBroadcasts", () => {
  const message = {
    id: "11111111-1111-4111-8111-111111111111",
    conversation_id: "22222222-2222-4222-8222-222222222222",
    sender_id: "33333333-3333-4333-8333-333333333333",
    content: "Is this still available?",
    created_at: "2026-10-12T16:00:00.000Z",
    is_read: false,
    offer_id: null,
  }
  const buyerId = "44444444-4444-4444-8444-444444444444"

  it("notifies the open thread and each participant inbox", () => {
    const broadcasts = marketplaceInsertedMessageBroadcasts(message, [message.sender_id, buyerId])
    assert.deepEqual(
      broadcasts.map((broadcast) => broadcast.topic),
      [
        marketplaceThreadChannel(message.conversation_id),
        marketplaceInboxChannel(message.sender_id),
        marketplaceInboxChannel(buyerId),
      ],
    )
    assert.equal(broadcasts[1]?.event, MARKETPLACE_THREAD_MESSAGE_EVENT)
    assert.equal(broadcasts[1]?.payload, message)
  })

  it("lists a participant once when both sides are the same id", () => {
    const broadcasts = marketplaceInsertedMessageBroadcasts(message, [buyerId, buyerId])
    assert.equal(broadcasts.length, 2)
  })
})

describe("marketplaceThreadRefreshBroadcasts", () => {
  it("includes the thread and each inbox", () => {
    const conversationId = "22222222-2222-4222-8222-222222222222"
    const userId = "33333333-3333-4333-8333-333333333333"
    const broadcasts = marketplaceThreadRefreshBroadcasts(conversationId, [userId])
    assert.equal(broadcasts.length, 2)
    assert.equal(broadcasts[0]?.topic, marketplaceThreadChannel(conversationId))
    assert.equal(broadcasts[1]?.topic, marketplaceInboxChannel(userId))
    assert.deepEqual(broadcasts[0]?.payload, { conversation_id: conversationId })
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
