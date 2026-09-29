import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isAccountBannedError } from "../auth/is-account-banned-error.ts"
import {
  classifyAccountAccess,
  isPermanentRestrictionUntil,
  isUserAuthBanned,
  PERMANENT_ACCOUNT_RESTRICTED_UNTIL,
} from "./account-ban-errors.ts"

describe("permanent account ban helpers", () => {
  it("treats a future banned_until as an auth ban", () => {
    assert.equal(isUserAuthBanned({ banned_until: "2099-12-31T23:59:59.999Z" }), true)
    assert.equal(isUserAuthBanned({ banned_until: "2000-01-01T00:00:00.000Z" }), false)
    assert.equal(isUserAuthBanned({ banned_until: null }), false)
    assert.equal(isUserAuthBanned({ app_metadata: { banned: true } }), true)
    assert.equal(isUserAuthBanned({ app_metadata: { banned: false } }), false)
    assert.equal(isUserAuthBanned(null), false)
  })

  it("recognizes the permanent restriction timestamp", () => {
    assert.equal(isPermanentRestrictionUntil(PERMANENT_ACCOUNT_RESTRICTED_UNTIL), true)
    assert.equal(isPermanentRestrictionUntil("2100-01-01T00:00:00.000Z"), true)
    assert.equal(isPermanentRestrictionUntil("2026-09-16T00:00:00.000Z"), false)
    assert.equal(isPermanentRestrictionUntil(null), false)
  })

  it("classifies permanent bans separately from temporary locks", () => {
    const now = Date.parse("2026-09-29T12:00:00.000Z")
    assert.equal(classifyAccountAccess(null, now), "active")
    assert.equal(classifyAccountAccess(PERMANENT_ACCOUNT_RESTRICTED_UNTIL, now), "banned")
    assert.equal(classifyAccountAccess("2100-01-01T00:00:00.000Z", now), "banned")
    assert.equal(classifyAccountAccess("2026-09-30T12:00:00.000Z", now), "locked")
    assert.equal(classifyAccountAccess("2026-09-28T12:00:00.000Z", now), "active")
  })

  it("detects GoTrue banned sign-in errors", () => {
    assert.equal(isAccountBannedError({ code: "user_banned", message: "User is banned" }), true)
    assert.equal(isAccountBannedError({ message: "User is banned" }), true)
    assert.equal(isAccountBannedError({ message: "Invalid login credentials" }), false)
    assert.equal(isAccountBannedError(null), false)
  })
})
