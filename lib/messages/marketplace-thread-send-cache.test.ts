import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  confirmMarketplaceThreadSend,
  forgetMarketplaceThreadSend,
  getMarketplaceThreadSends,
  mergeCachedMarketplaceThreadSends,
  pruneMarketplaceThreadSends,
  rememberMarketplaceThreadSend,
} from "./marketplace-thread-send-cache.ts"

describe("mergeCachedMarketplaceThreadSends", () => {
  it("appends a pending send the snapshot does not have yet", () => {
    const merged = mergeCachedMarketplaceThreadSends(
      [
        {
          id: "server-1",
          content: "earlier",
          sender_id: "me",
          created_at: "2026-11-09T12:00:00.000Z",
        },
      ],
      [
        {
          conversationId: "c1",
          id: "pending-1",
          content: "just sent",
          senderId: "me",
          createdAt: "2026-11-09T12:01:00.000Z",
          sendStatus: "sending",
        },
      ],
    )

    assert.deepEqual(
      merged.map((message) => message.id),
      ["server-1", "pending-1"],
    )
    assert.equal(merged[1]?.sendStatus, "sending")
  })

  it("replaces a pending bubble with the confirmed row", () => {
    const merged = mergeCachedMarketplaceThreadSends(
      [
        {
          id: "pending-1",
          content: "just sent",
          sender_id: "me",
          created_at: "2026-11-09T12:01:00.000Z",
          sendStatus: "sending",
        },
      ],
      [
        {
          conversationId: "c1",
          id: "pending-1",
          content: "just sent",
          senderId: "me",
          createdAt: "2026-11-09T12:01:00.000Z",
          sendStatus: "sending",
          confirmed: {
            id: "server-2",
            content: "just sent",
            sender_id: "me",
            created_at: "2026-11-09T12:01:00.100Z",
            is_read: false,
          },
        },
      ],
    )

    assert.deepEqual(
      merged.map((message) => message.id),
      ["server-2"],
    )
    assert.equal(merged[0]?.sendStatus, undefined)
  })

  it("does not duplicate a confirmed row already in the snapshot", () => {
    const merged = mergeCachedMarketplaceThreadSends(
      [
        {
          id: "server-2",
          content: "just sent",
          sender_id: "me",
          created_at: "2026-11-09T12:01:00.100Z",
        },
      ],
      [
        {
          conversationId: "c1",
          id: "pending-1",
          content: "just sent",
          senderId: "me",
          createdAt: "2026-11-09T12:01:00.000Z",
          sendStatus: "sending",
          confirmed: {
            id: "server-2",
            content: "just sent",
            sender_id: "me",
            created_at: "2026-11-09T12:01:00.100Z",
          },
        },
      ],
    )

    assert.deepEqual(
      merged.map((message) => message.id),
      ["server-2"],
    )
  })

  it("drops a pending bubble once it leaves the cache", () => {
    const merged = mergeCachedMarketplaceThreadSends(
      [
        {
          id: "server-1",
          content: "earlier",
          sender_id: "me",
          created_at: "2026-11-09T12:00:00.000Z",
        },
        {
          id: "pending-gone",
          content: "just sent",
          sender_id: "me",
          created_at: "2026-11-09T12:01:00.000Z",
          sendStatus: "sending",
        },
      ],
      [],
    )

    assert.deepEqual(
      merged.map((message) => message.id),
      ["server-1"],
    )
  })

  it("patches sendStatus on an existing pending bubble", () => {
    const merged = mergeCachedMarketplaceThreadSends(
      [
        {
          id: "pending-1",
          content: "just sent",
          sender_id: "me",
          created_at: "2026-11-09T12:01:00.000Z",
          sendStatus: "sending",
        },
      ],
      [
        {
          conversationId: "c1",
          id: "pending-1",
          content: "just sent",
          senderId: "me",
          createdAt: "2026-11-09T12:01:00.000Z",
          sendStatus: "failed",
        },
      ],
    )

    assert.equal(merged[0]?.sendStatus, "failed")
  })
})

describe("marketplace thread send cache", () => {
  it("prunes a confirmed send once the thread has the server id", () => {
    rememberMarketplaceThreadSend({
      conversationId: "c-prune",
      id: "pending-prune",
      content: "hi",
      senderId: "me",
      createdAt: "2026-11-09T12:01:00.000Z",
      sendStatus: "sending",
    })
    confirmMarketplaceThreadSend("pending-prune", {
      id: "server-prune",
      content: "hi",
      sender_id: "me",
      created_at: "2026-11-09T12:01:00.100Z",
    })
    assert.equal(getMarketplaceThreadSends("c-prune").length, 1)
    pruneMarketplaceThreadSends("c-prune", ["server-prune"])
    assert.equal(getMarketplaceThreadSends("c-prune").length, 0)
    forgetMarketplaceThreadSend("pending-prune")
  })
})
