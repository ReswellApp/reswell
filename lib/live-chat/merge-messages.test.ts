import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mergeIncomingLiveChatUiMessage, mergeLiveChatUiMessages } from "./merge-messages.ts"

describe("mergeLiveChatUiMessages", () => {
  it("appends a new message", () => {
    const next = mergeLiveChatUiMessages(
      [{ id: "1", created_at: "2026-09-19T12:00:00.000Z", content: "hi" }],
      { id: "2", created_at: "2026-09-19T12:00:05.000Z", content: "here" },
    )
    assert.deepEqual(
      next.map((row) => row.id),
      ["1", "2"],
    )
  })

  it("replaces content when the same id is re-rolled", () => {
    const next = mergeLiveChatUiMessages(
      [{ id: "1", created_at: "2026-09-19T12:00:00.000Z", content: "old" }],
      { id: "1", created_at: "2026-09-19T12:00:00.000Z", content: "new" },
    )
    assert.equal(next.length, 1)
    assert.equal(next[0]?.content, "new")
  })
})

describe("mergeIncomingLiveChatUiMessage", () => {
  it("replaces a re-rolled bubble instead of keeping the stale row", () => {
    const next = mergeIncomingLiveChatUiMessage(
      [
        {
          id: "a1",
          created_at: "2026-09-19T12:00:00.000Z",
          sender_type: "agent",
          content: "old auto reply",
        },
      ],
      {
        id: "a1",
        created_at: "2026-09-19T12:00:00.000Z",
        sender_type: "agent",
        content: "new auto reply",
      },
    )
    assert.equal(next.length, 1)
    assert.equal(next[0]?.content, "new auto reply")
  })

  it("confirms an optimistic visitor send when the server id differs", () => {
    const next = mergeIncomingLiveChatUiMessage(
      [
        {
          id: "tmp",
          created_at: "2026-09-19T12:00:00.000Z",
          sender_type: "visitor",
          content: "hello",
          pending: true,
        },
      ],
      {
        id: "v1",
        created_at: "2026-09-19T12:00:01.000Z",
        sender_type: "visitor",
        content: "hello",
      },
    )
    assert.deepEqual(
      next.map((row) => ({ id: row.id, pending: row.pending })),
      [{ id: "v1", pending: false }],
    )
  })
})
