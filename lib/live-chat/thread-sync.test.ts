import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  hasTeamReplySince,
  latestConversationalIsTeam,
  latestConversationalIsVisitor,
} from "./thread-sync.ts"

function row(sender_type: "visitor" | "agent" | "system" | "bot") {
  return { sender_type }
}

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
