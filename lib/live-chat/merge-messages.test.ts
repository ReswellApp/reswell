import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mergeLiveChatUiMessages } from "./merge-messages.ts"

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
