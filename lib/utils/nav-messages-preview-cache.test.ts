import assert from "node:assert/strict"
import { describe, it, beforeEach } from "node:test"

import type { MessagesInboxNotification } from "../db/messagesInbox.ts"
import type { InboxConversationRow } from "./messages-inbox-grouping.ts"
import {
  clearNavMessagesPreviewCache,
  isNavMessagesPreviewCacheStale,
  patchNavMessagesPreviewCache,
  readNavMessagesPreviewCache,
  writeNavMessagesPreviewCache,
} from "./nav-messages-preview-cache.ts"

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

const emptyConversations: InboxConversationRow[] = []
const note = (id: string): MessagesInboxNotification => ({
  id,
  type: "listing_saved",
  listing_id: null,
  actor_id: null,
  message: "Someone saved your item",
  is_read: false,
  created_at: "2026-11-08T12:00:00.000Z",
  listings: null,
})

describe("nav-messages-preview-cache", () => {
  beforeEach(() => {
    clearNavMessagesPreviewCache()
  })

  it("stores and reads a preview per user", () => {
    writeNavMessagesPreviewCache(USER_A, {
      conversations: emptyConversations,
      notifications: [note("n-1")],
    })
    writeNavMessagesPreviewCache(USER_B, {
      conversations: emptyConversations,
      notifications: [note("n-2")],
    })

    assert.equal(readNavMessagesPreviewCache(USER_A)?.notifications[0]?.id, "n-1")
    assert.equal(readNavMessagesPreviewCache(USER_B)?.notifications[0]?.id, "n-2")
  })

  it("patches an existing entry and refreshes updatedAt", () => {
    const first = writeNavMessagesPreviewCache(USER_A, {
      conversations: emptyConversations,
      notifications: [note("n-1")],
    })
    const patched = patchNavMessagesPreviewCache(USER_A, (current) => ({
      conversations: current.conversations,
      notifications: current.notifications.map((n) => ({ ...n, is_read: true })),
    }))

    assert.ok(patched)
    assert.equal(patched.notifications[0]?.is_read, true)
    assert.ok(patched.updatedAt >= first.updatedAt)
  })

  it("returns null when patching a missing user", () => {
    assert.equal(
      patchNavMessagesPreviewCache(USER_A, (current) => current),
      null,
    )
  })

  it("treats missing and aged entries as stale", () => {
    assert.equal(isNavMessagesPreviewCacheStale(null), true)

    const fresh = writeNavMessagesPreviewCache(USER_A, {
      conversations: emptyConversations,
      notifications: [],
    })
    assert.equal(isNavMessagesPreviewCacheStale(fresh, fresh.updatedAt, 30_000), false)
    assert.equal(
      isNavMessagesPreviewCacheStale(fresh, fresh.updatedAt + 30_000, 30_000),
      true,
    )
  })

  it("clears one user or the whole cache", () => {
    writeNavMessagesPreviewCache(USER_A, {
      conversations: emptyConversations,
      notifications: [note("n-1")],
    })
    writeNavMessagesPreviewCache(USER_B, {
      conversations: emptyConversations,
      notifications: [note("n-2")],
    })

    clearNavMessagesPreviewCache(USER_A)
    assert.equal(readNavMessagesPreviewCache(USER_A), null)
    assert.ok(readNavMessagesPreviewCache(USER_B))

    clearNavMessagesPreviewCache()
    assert.equal(readNavMessagesPreviewCache(USER_B), null)
  })
})
