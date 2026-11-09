import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mobileSignUpBodySchema, type MobileSignUpBody } from "@reswell/api-contract"
import { prepareMobileEmailSignUp } from "./prepareMobileEmailSignUp.ts"

const VALID_PASSWORD = "Surfboard-Day1"

function body(overrides: Partial<MobileSignUpBody> = {}): MobileSignUpBody {
  return {
    email: "surfer@example.com",
    password: VALID_PASSWORD,
    first_name: "John",
    last_name: "Doe",
    username: "",
    marketing_opt_in: true,
    accepted_terms: true,
    ...overrides,
  }
}

describe("prepareMobileEmailSignUp", () => {
  it("uses the website default public name when username is blank", () => {
    const result = prepareMobileEmailSignUp(body())
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.metadata.display_name, "DJohn")
    assert.equal(result.value.metadata.username, undefined)
    assert.equal(result.value.metadata.marketing_opt_in, true)
  })

  it("keeps a chosen username as the public name", () => {
    const result = prepareMobileEmailSignUp(body({ username: "dawnpatrol" }))
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.metadata.display_name, "dawnpatrol")
    assert.equal(result.value.metadata.username, "dawnpatrol")
  })

  it("rejects a short password with the website message", () => {
    const result = prepareMobileEmailSignUp(body({ password: "short" }))
    assert.deepEqual(result, {
      ok: false,
      error: "Password must be at least 12 characters.",
    })
  })

  it("rejects a public name that is too short", () => {
    const result = prepareMobileEmailSignUp(body({ first_name: "A", last_name: "B" }))
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.match(result.error, /at least 5 characters/)
  })

  it("rejects a blocked username before Auth is called", () => {
    const result = prepareMobileEmailSignUp(body({ username: "bullshit" }))
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error, "Please choose a different display name.")
  })

  it("rejects sign-up until the terms are accepted", () => {
    const parsed = mobileSignUpBodySchema.safeParse({ ...body(), accepted_terms: false })
    assert.equal(parsed.success, false)
    if (parsed.success) return
    assert.equal(
      parsed.error.issues[0]?.message,
      "Please accept Reswell's Terms of Use and Privacy Policy to continue.",
    )
  })
})
