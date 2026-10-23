import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mobileGoogleAuthorizeTarget, mobileGoogleHandoffUrl } from "./mobile-google-handoff.ts"

const SUPABASE = "https://project.supabase.co"
const AUTHORIZE =
  "https://project.supabase.co/auth/v1/authorize?provider=google&redirect_to=reswell%3A%2F%2Fauth%2Fcallback&code_challenge=abc"

describe("mobile google sign-in handoff", () => {
  it("starts the phone session on reswell.app", () => {
    const start = new URL(mobileGoogleHandoffUrl("https://reswell.app", AUTHORIZE))
    assert.equal(start.origin, "https://reswell.app")
    assert.equal(start.pathname, "/api/mobile/v1/auth/google")
    assert.equal(start.searchParams.get("url"), AUTHORIZE)
  })

  it("accepts only this project's authorize URL", () => {
    assert.equal(mobileGoogleAuthorizeTarget(SUPABASE, AUTHORIZE)?.hostname, "project.supabase.co")
    assert.equal(mobileGoogleAuthorizeTarget(SUPABASE, "https://evil.example/auth/v1/authorize"), null)
    assert.equal(
      mobileGoogleAuthorizeTarget(SUPABASE, "https://project.supabase.co/auth/v1/token"),
      null,
    )
    assert.equal(mobileGoogleAuthorizeTarget(SUPABASE, "http://project.supabase.co/auth/v1/authorize"), null)
  })
})
