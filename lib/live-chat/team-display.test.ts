import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isLegacyLiveChatWidgetCopy,
  liveChatAgentDisplayName,
  liveChatCaseAlreadyHasVisitorTurn,
} from "./team-display.ts"

describe("liveChatAgentDisplayName", () => {
  it("labels unassigned agent and bot messages as Reswell Team", () => {
    assert.equal(
      liveChatAgentDisplayName({ senderType: "agent", senderAgentId: null }),
      "Reswell Team",
    )
    assert.equal(liveChatAgentDisplayName({ senderType: "bot" }), "Reswell Team")
    assert.equal(
      liveChatAgentDisplayName({
        senderType: "agent",
        senderAgentId: "staff-1",
        lookedUpName: "Hayden",
      }),
      "Hayden",
    )
  })
})

describe("isLegacyLiveChatWidgetCopy", () => {
  it("hides leftover human-handoff and missing-session copy", () => {
    assert.equal(
      isLegacyLiveChatWidgetCopy(
        "You've asked for a human teammate. We'll reply here — usually within one business day.",
      ),
      true,
    )
    assert.equal(isLegacyLiveChatWidgetCopy("Chat session not found."), true)
    assert.equal(
      isLegacyLiveChatWidgetCopy("We hope you have been scoring waves — how can we help you?"),
      false,
    )
  })
})

describe("liveChatCaseAlreadyHasVisitorTurn", () => {
  it("detects a transcript line from the opening live-chat case message", () => {
    assert.equal(
      liveChatCaseAlreadyHasVisitorTurn(
        [{ author_role: "customer", body: "Member: Where is my order?" }],
        "Where is my order?",
      ),
      true,
    )
    assert.equal(
      liveChatCaseAlreadyHasVisitorTurn(
        [{ author_role: "customer", body: "Where is my order?" }],
        "Something else",
      ),
      false,
    )
  })
})
