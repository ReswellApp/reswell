import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mobileGoogleSignUpBodySchema } from "@reswell/api-contract"

const TOKEN = "google-id-token"

describe("mobileGoogleSignUpBodySchema", () => {
  it("accepts a Google token with the sign-up checkboxes", () => {
    const parsed = mobileGoogleSignUpBodySchema.safeParse({
      id_token: TOKEN,
      marketing_opt_in: true,
      accepted_terms: true,
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.marketing_opt_in, true)
    assert.equal(parsed.data.nonce, undefined)
  })

  it("keeps the nonce when iOS sends one", () => {
    const parsed = mobileGoogleSignUpBodySchema.safeParse({
      id_token: TOKEN,
      nonce: "raw-nonce",
      access_token: "google-access",
      marketing_opt_in: false,
      accepted_terms: true,
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.nonce, "raw-nonce")
    assert.equal(parsed.data.access_token, "google-access")
  })

  it("rejects sign-up until the terms are accepted", () => {
    const parsed = mobileGoogleSignUpBodySchema.safeParse({
      id_token: TOKEN,
      marketing_opt_in: true,
      accepted_terms: false,
    })
    assert.equal(parsed.success, false)
    if (parsed.success) return
    assert.equal(
      parsed.error.issues[0]?.message,
      "Please accept Reswell's Terms of Use and Privacy Policy to continue.",
    )
  })
})
