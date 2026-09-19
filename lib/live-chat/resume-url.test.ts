import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LIVE_CHAT_RESUME_QUERY,
  liveChatVisitorResumeAbsoluteUrl,
  liveChatVisitorResumeHref,
  parseLiveChatResumePublicId,
} from "./resume-url.ts"

describe("live chat resume URL", () => {
  it("accepts lc_ public ids and normalizes hex", () => {
    assert.equal(parseLiveChatResumePublicId("lc_A1B2C3D4E5F67890"), "lc_a1b2c3d4e5f67890")
    assert.equal(parseLiveChatResumePublicId("  lc_a1b2c3d4e5f67890  "), "lc_a1b2c3d4e5f67890")
    assert.equal(parseLiveChatResumePublicId("lc_short"), null)
    assert.equal(parseLiveChatResumePublicId("not-a-chat"), null)
    assert.equal(parseLiveChatResumePublicId(null), null)
  })

  it("builds the widget deep link used in Support Tickets Response emails", () => {
    assert.equal(LIVE_CHAT_RESUME_QUERY, "chat")
    assert.equal(
      liveChatVisitorResumeHref("lc_a1b2c3d4e5f67890"),
      "/?chat=lc_a1b2c3d4e5f67890",
    )
    assert.equal(
      liveChatVisitorResumeAbsoluteUrl("https://www.reswell.app/", "lc_a1b2c3d4e5f67890"),
      "https://www.reswell.app/?chat=lc_a1b2c3d4e5f67890",
    )
    assert.equal(liveChatVisitorResumeHref("nope"), "/")
  })
})
