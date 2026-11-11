import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildOAuthCallbackUrl } from "./oauth-callback-url.ts"

describe("buildOAuthCallbackUrl", () => {
  it("forwards marketing consent and birthday on the callback URL", () => {
    const url = new URL(
      buildOAuthCallbackUrl("/dashboard", "https://reswell.app", true, "2000-05-01"),
    )
    assert.equal(url.pathname, "/auth/callback")
    assert.equal(url.searchParams.get("next"), "/dashboard")
    assert.equal(url.searchParams.get("marketing"), "1")
    assert.equal(url.searchParams.get("dob"), "2000-05-01")
  })

  it("omits optional signup params for login", () => {
    const url = new URL(buildOAuthCallbackUrl("/", "https://reswell.app"))
    assert.equal(url.searchParams.get("marketing"), null)
    assert.equal(url.searchParams.get("dob"), null)
  })
})
