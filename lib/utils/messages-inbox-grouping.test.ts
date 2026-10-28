import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  applyInboxThreadActivity,
  getUnreadCountForConversation,
  groupConversationsByCounterparty,
  inboxActivityFromMessageRow,
  markConversationMessagesReadLocally,
  mergeInboxConversationSnapshots,
  type InboxConversationRow,
} from "./messages-inbox-grouping.ts"

const ME = "11111111-1111-4111-8111-111111111111"
const THEM = "22222222-2222-4222-8222-222222222222"
const OTHER = "33333333-3333-4333-8333-333333333333"

function conversation(
  id: string,
  lastMessageAt: string,
  messages: InboxConversationRow["messages"],
  otherUserId = THEM,
): InboxConversationRow {
  return {
    id,
    listing_id: null,
    buyer_id: ME,
    seller_id: otherUserId,
    last_message_at: lastMessageAt,
    listing: null,
    buyer: { id: ME, display_name: "Me", avatar_url: null },
    seller: { id: otherUserId, display_name: "Them", avatar_url: null },
    messages,
  }
}

describe("inbox ordering and unread", () => {
  it("puts the newest thread first and shows an unread count", () => {
    const older = conversation("older", "2026-10-01T12:00:00.000Z", [
      {
        id: "m1",
        content: "earlier",
        is_read: true,
        sender_id: THEM,
        created_at: "2026-10-01T12:00:00.000Z",
      },
    ])
    const newer = conversation(
      "newer",
      "2026-10-02T12:00:00.000Z",
      [
        {
          id: "m2",
          content: "just in",
          is_read: false,
          sender_id: THEM,
          created_at: "2026-10-02T12:00:00.000Z",
        },
      ],
      OTHER,
    )

    const groups = groupConversationsByCounterparty([older, newer], ME)
    assert.deepEqual(
      groups.map((group) => group.primaryThread.id),
      ["newer", "older"],
    )
    assert.equal(groups[0]?.totalUnread, 1)
    assert.equal(groups[1]?.totalUnread, 0)
  })

  it("moves a thread to the top when you reply, without an unread bubble", () => {
    const quiet = conversation(
      "quiet",
      "2026-10-03T12:00:00.000Z",
      [
        {
          id: "m-quiet",
          content: "old",
          is_read: true,
          sender_id: OTHER,
          created_at: "2026-10-03T12:00:00.000Z",
        },
      ],
      OTHER,
    )
    const replied = conversation("replied", "2026-10-01T12:00:00.000Z", [
      {
        id: "m-old",
        content: "hello",
        is_read: true,
        sender_id: THEM,
        created_at: "2026-10-01T12:00:00.000Z",
      },
    ])

    const next = applyInboxThreadActivity([quiet, replied], {
      conversationId: "replied",
      at: "2026-10-04T15:00:00.000Z",
      message: {
        id: "m-reply",
        content: "on my way",
        is_read: true,
        sender_id: ME,
        created_at: "2026-10-04T15:00:00.000Z",
      },
    })

    const groups = groupConversationsByCounterparty(next, ME)
    assert.equal(groups[0]?.primaryThread.id, "replied")
    assert.equal(groups[0]?.latestMessage?.content, "on my way")
    assert.equal(getUnreadCountForConversation(next[1]!, ME), 0)
  })

  it("clears the unread bubble after the thread is opened", () => {
    const row = conversation("thread", "2026-10-04T12:00:00.000Z", [
      {
        id: "m-new",
        content: "you there?",
        is_read: false,
        sender_id: THEM,
        created_at: "2026-10-04T12:00:00.000Z",
      },
    ])
    const read = markConversationMessagesReadLocally([row], "thread", ME)
    assert.equal(getUnreadCountForConversation(read[0]!, ME), 0)
  })

  it("keeps a read message read when a stale snapshot still says unread", () => {
    const local = conversation("thread", "2026-10-04T16:00:00.000Z", [
      {
        id: "m-new",
        content: "latest",
        is_read: true,
        sender_id: ME,
        created_at: "2026-10-04T16:00:00.000Z",
      },
      {
        id: "m-old",
        content: "ping",
        is_read: true,
        sender_id: THEM,
        created_at: "2026-10-04T12:00:00.000Z",
      },
    ])
    const stale = conversation("thread", "2026-10-04T12:00:00.000Z", [
      {
        id: "m-old",
        content: "ping",
        is_read: false,
        sender_id: THEM,
        created_at: "2026-10-04T12:00:00.000Z",
      },
    ])

    const merged = mergeInboxConversationSnapshots([local], [stale])
    const groups = groupConversationsByCounterparty(merged, ME)
    assert.equal(groups[0]?.latestMessage?.content, "latest")
    assert.equal(groups[0]?.totalUnread, 0)
  })

  it("reads a realtime message row into inbox activity", () => {
    const activity = inboxActivityFromMessageRow({
      id: "m-live",
      conversation_id: "thread",
      content: "new",
      is_read: false,
      sender_id: THEM,
      created_at: "2026-10-05T12:00:00.000Z",
    })
    assert.equal(activity?.conversationId, "thread")
    assert.equal(activity?.message?.is_read, false)
    assert.equal(inboxActivityFromMessageRow({}), null)
  })
})
