import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  mergeServerMessagesPreservingLocalPolicyBlocks,
  replaceMatchingPendingThreadMessage,
} from "./local-phone-policy-block-message"

describe("replaceMatchingPendingThreadMessage", () => {
  it("replaces only the oldest matching pending bubble", () => {
    const replaced = replaceMatchingPendingThreadMessage(
      [
        {
          id: "pending-1",
          content: "hey",
          sender_id: "me",
        },
        {
          id: "pending-2",
          content: "hey",
          sender_id: "me",
        },
      ],
      {
        id: "server-1",
        content: "hey",
        sender_id: "me",
      },
    )

    assert.deepEqual(
      replaced.map((message) => message.id),
      ["server-1", "pending-2"],
    )
  })

  it("appends when no pending bubble matches", () => {
    const replaced = replaceMatchingPendingThreadMessage(
      [
        {
          id: "server-1",
          content: "earlier",
          sender_id: "them",
        },
      ],
      {
        id: "server-2",
        content: "new",
        sender_id: "them",
      },
    )

    assert.deepEqual(
      replaced.map((message) => message.id),
      ["server-1", "server-2"],
    )
  })

  it("is a no-op when the inserted id is already in the thread", () => {
    const previous = [
      {
        id: "server-1",
        content: "hey",
        sender_id: "me",
      },
    ]
    assert.equal(
      replaceMatchingPendingThreadMessage(previous, {
        id: "server-1",
        content: "hey",
        sender_id: "me",
      }),
      previous,
    )
  })
})

describe("mergeServerMessagesPreservingLocalPolicyBlocks", () => {
  it("keeps a pending send the snapshot has not caught up to", () => {
    const merged = mergeServerMessagesPreservingLocalPolicyBlocks(
      [
        {
          id: "server-1",
          content: "earlier",
          sender_id: "me",
          created_at: "2026-10-08T12:00:00.000Z",
        },
        {
          id: "pending-1",
          content: "just sent",
          sender_id: "me",
          created_at: "2026-10-08T12:01:00.000Z",
        },
      ],
      [
        {
          id: "server-1",
          content: "earlier",
          sender_id: "me",
          created_at: "2026-10-08T12:00:00.000Z",
        },
      ],
    )

    assert.deepEqual(
      merged.map((message) => message.id),
      ["server-1", "pending-1"],
    )
  })

  it("drops the pending row once the inserted message is in the snapshot", () => {
    const merged = mergeServerMessagesPreservingLocalPolicyBlocks(
      [
        {
          id: "pending-1",
          content: "just sent",
          sender_id: "me",
          created_at: "2026-10-08T12:01:00.000Z",
        },
      ],
      [
        {
          id: "server-2",
          content: "just sent",
          sender_id: "me",
          created_at: "2026-10-08T12:01:00.100Z",
        },
      ],
    )

    assert.deepEqual(
      merged.map((message) => message.id),
      ["server-2"],
    )
  })

  it("keeps a live row newer than a stale snapshot", () => {
    const merged = mergeServerMessagesPreservingLocalPolicyBlocks(
      [
        {
          id: "server-1",
          content: "earlier",
          sender_id: "them",
          created_at: "2026-10-08T12:00:00.000Z",
        },
        {
          id: "live-2",
          content: "new",
          sender_id: "them",
          created_at: "2026-10-08T12:05:00.000Z",
        },
      ],
      [
        {
          id: "server-1",
          content: "earlier",
          sender_id: "them",
          created_at: "2026-10-08T12:00:00.000Z",
        },
      ],
    )

    assert.deepEqual(
      merged.map((message) => message.id),
      ["server-1", "live-2"],
    )
  })

  it("keeps a local policy reminder and drops history the server no longer returns", () => {
    const merged = mergeServerMessagesPreservingLocalPolicyBlocks(
      [
        {
          id: "old-local",
          content: "gone",
          sender_id: "me",
          created_at: "2026-10-08T11:00:00.000Z",
        },
        {
          id: "local-policy-block-1",
          content: "",
          sender_id: "me",
          created_at: "2026-10-08T12:02:00.000Z",
          metadata: {
            kind: "local_policy_block",
            reasonCode: "phone_like",
            originalContent: "555",
          },
        },
      ],
      [
        {
          id: "server-1",
          content: "kept",
          sender_id: "them",
          created_at: "2026-10-08T12:03:00.000Z",
        },
      ],
    )

    assert.deepEqual(
      merged.map((message) => message.id),
      ["local-policy-block-1", "server-1"],
    )
  })
})