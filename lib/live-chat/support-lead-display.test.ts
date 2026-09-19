import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { LIVE_CHAT_PERSONAS, liveChatJoinMessage, liveChatPersonaTeamMember } from "./human-feel.ts"
import {
  LIVE_CHAT_SUPPORT_DAVID_FALLBACK,
  LIVE_CHAT_SUPPORT_LEAD_FALLBACK,
  matchSupportTeamMemberByName,
  resolveWorkingSupportAgent,
} from "./support-lead-display.ts"

const team = [
  liveChatPersonaTeamMember(LIVE_CHAT_PERSONAS.hayden),
  liveChatPersonaTeamMember(LIVE_CHAT_PERSONAS.david),
]

describe("resolveWorkingSupportAgent", () => {
  it("matches Hayden or David by first name after they join", () => {
    assert.equal(matchSupportTeamMemberByName(team, "Hayden")?.id, "hayden-garfield")
    assert.equal(matchSupportTeamMemberByName(team, "David Kalt")?.id, "david-kalt")

    const afterJoin = resolveWorkingSupportAgent(
      [{ sender_type: "system", content: liveChatJoinMessage("David") }],
      team,
    )
    assert.equal(afterJoin?.name, "David Kalt")
    assert.equal(afterJoin?.imageUrl, LIVE_CHAT_SUPPORT_DAVID_FALLBACK.imageUrl)

    const afterReply = resolveWorkingSupportAgent(
      [{ sender_type: "agent", sender_agent_id: null, agent_display_name: "Hayden" }],
      team,
    )
    assert.equal(afterReply?.name, LIVE_CHAT_SUPPORT_LEAD_FALLBACK.name)
  })
})
