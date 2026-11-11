import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildGoogleOAuthHandoffUrl } from "./google-oauth-handoff-url.ts"

describe("buildGoogleOAuthHandoffUrl", () => {
  it("carries birthday on the sign-up handoff so in-app browsers do not drop it", () => {
    const url = new URL(
      buildGoogleOAuthHandoffUrl("https://reswell.app", "/sell", "sign-up", true, "1999-12-31"),
    )
    assert.equal(url.pathname, "/auth/sign-up")
    assert.equal(url.searchParams.get("google"), "1")
    assert.equal(url.searchParams.get("marketing"), "1")
    assert.equal(url.searchParams.get("dob"), "1999-12-31")
  })
})
