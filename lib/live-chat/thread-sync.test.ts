import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  hasTeamReplySince,
  isLatestLiveChatAutoReply,
  latestConversationalIsTeam,
  latestConversationalIsVisitor,
  latestLiveChatAutoReplyId,
} from "./thread-sync.ts"

function row(sender_type: "visitor" | "agent" | "system" | "bot") {
  return { sender_type }
}

describe("latestLiveChatAutoReplyId", () => {
  it("only returns the latest unassigned agent bubble", () => {
    const messages = [
      { id: "v1", sender_type: "visitor" as const, sender_agent_id: null },
      { id: "a1", sender_type: "agent" as const, sender_agent_id: null },
      { id: "v2", sender_type: "visitor" as const, sender_agent_id: null },
      { id: "a2", sender_type: "agent" as const, sender_agent_id: null },
    ]
    assert.equal(latestLiveChatAutoReplyId(messages), "a2")
    assert.equal(isLatestLiveChatAutoReply(messages, "a2"), true)
    assert.equal(isLatestLiveChatAutoReply(messages, "a1"), false)
  })

  it("does not re-roll after a visitor follow-up or a human agent", () => {
    assert.equal(
      latestLiveChatAutoReplyId([
        { id: "a1", sender_type: "agent", sender_agent_id: null },
        { id: "v1", sender_type: "visitor", sender_agent_id: null },
      ]),
      null,
    )
    assert.equal(
      latestLiveChatAutoReplyId([
        { id: "a1", sender_type: "agent", sender_agent_id: null },
        { id: "h1", sender_type: "agent", sender_agent_id: "staff" },
      ]),
      null,
    )
  })
})

describe("latestConversationalIsTeam", () => {
  it("ignores join lines and waits until an agent or bot turn", () => {
    assert.equal(
      latestConversationalIsTeam([
        row("visitor"),
        row("system"),
      ]),
      false,
    )
    assert.equal(
      latestConversationalIsTeam([
        row("visitor"),
        row("system"),
        row("agent"),
      ]),
      true,
    )
    assert.equal(latestConversationalIsVisitor([row("visitor"), row("system")]), true)
  })

  it("only counts a team reply at or after the visitor turn", () => {
    assert.equal(
      hasTeamReplySince(
        [
          { sender_type: "agent", created_at: "2026-09-19T12:00:00.000Z" },
          { sender_type: "visitor", created_at: "2026-09-19T12:01:00.000Z" },
        ],
        "2026-09-19T12:01:00.000Z",
      ),
      false,
    )
    assert.equal(
      hasTeamReplySince(
        [
          { sender_type: "agent", created_at: "2026-09-19T12:00:00.000Z" },
          { sender_type: "visitor", created_at: "2026-09-19T12:01:00.000Z" },
          { sender_type: "agent", created_at: "2026-09-19T12:01:20.000Z" },
        ],
        "2026-09-19T12:01:00.000Z",
      ),
      true,
    )
  })
})
