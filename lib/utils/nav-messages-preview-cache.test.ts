import assert from "node:assert/strict"
import { describe, it, beforeEach, afterEach } from "node:test"

import type { MessagesInboxNotification } from "../db/messagesInbox.ts"
import type { InboxConversationRow } from "./messages-inbox-grouping.ts"
import {
  NAV_MESSAGES_PREVIEW_CACHE_STORAGE_KEY,
  clearNavMessagesPreviewCache,
  isNavMessagesPreviewCacheStale,
  loadNavMessagesPreview,
  patchNavMessagesPreviewCache,
  readNavMessagesPreviewCache,
  resetNavMessagesPreviewMemoryForTests,
  subscribeNavMessagesPreviewCache,
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

class MemoryStorage {
  store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
}

const storage = new MemoryStorage()
Object.defineProperty(globalThis, "sessionStorage", {
  value: storage,
  configurable: true,
})

describe("nav-messages-preview-cache", () => {
  beforeEach(() => {
    storage.clear()
    resetNavMessagesPreviewMemoryForTests()
  })

  afterEach(() => {
    clearNavMessagesPreviewCache()
    resetNavMessagesPreviewMemoryForTests()
    storage.clear()
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

  it("rehydrates from sessionStorage after a memory reset", () => {
    writeNavMessagesPreviewCache(USER_A, {
      conversations: emptyConversations,
      notifications: [note("n-session")],
    })
    assert.ok(storage.getItem(NAV_MESSAGES_PREVIEW_CACHE_STORAGE_KEY))

    resetNavMessagesPreviewMemoryForTests()
    assert.equal(readNavMessagesPreviewCache(USER_A)?.notifications[0]?.id, "n-session")
  })

  it("notifies subscribers on write and clear", () => {
    const events: Array<{ userId: string; id: string | null }> = []
    const unsubscribe = subscribeNavMessagesPreviewCache((userId, entry) => {
      events.push({ userId, id: entry?.notifications[0]?.id ?? null })
    })

    writeNavMessagesPreviewCache(USER_A, {
      conversations: emptyConversations,
      notifications: [note("n-sub")],
    })
    clearNavMessagesPreviewCache(USER_A)
    unsubscribe()
    writeNavMessagesPreviewCache(USER_A, {
      conversations: emptyConversations,
      notifications: [note("n-after")],
    })

    assert.deepEqual(events, [
      { userId: USER_A, id: "n-sub" },
      { userId: USER_A, id: null },
    ])
  })

  it("coalesces in-flight preview loads for the same user", async () => {
    let started = 0
    const fetchers = [
      loadNavMessagesPreview(USER_A, async () => {
        started += 1
        await new Promise((resolve) => setTimeout(resolve, 20))
        return {
          conversations: emptyConversations,
          notifications: [note("n-inflight")],
        }
      }),
      loadNavMessagesPreview(USER_A, async () => {
        started += 1
        return {
          conversations: emptyConversations,
          notifications: [note("n-second")],
        }
      }),
    ]

    const [first, second] = await Promise.all(fetchers)
    assert.equal(started, 1)
    assert.equal(first?.notifications[0]?.id, "n-inflight")
    assert.equal(second?.notifications[0]?.id, "n-inflight")
    assert.equal(readNavMessagesPreviewCache(USER_A)?.notifications[0]?.id, "n-inflight")
  })
})
