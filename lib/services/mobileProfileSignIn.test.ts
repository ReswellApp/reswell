import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { User } from "@supabase/supabase-js"
import { profileHasEmailPassword, profilePasswordChangeError } from "@/lib/services/mobileProfileSignIn"

function userWith(providers: string[]): User {
  return {
    identities: providers.map((provider) => ({ provider })),
  } as User
}

describe("mobile profile sign-in", () => {
  it("treats an email identity as a password login", () => {
    assert.equal(profileHasEmailPassword(userWith(["email"])), true)
    assert.equal(profileHasEmailPassword(userWith(["google"])), false)
    assert.equal(profileHasEmailPassword(userWith(["google", "email"])), true)
  })

  it("maps a rejected current password to the website message", () => {
    assert.equal(profilePasswordChangeError(400, { msg: "Invalid login credentials" }), "Current password is incorrect.")
    assert.equal(profilePasswordChangeError(422, { message: "Password should be at least 6 characters" }), "Password must be at least 6 characters.")
  })
})
