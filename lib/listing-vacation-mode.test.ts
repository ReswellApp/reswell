import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { canUseListingVacationMode } from "./listing-vacation-mode.ts"

describe("canUseListingVacationMode", () => {
  it("allows active and pending_sale listings", () => {
    assert.equal(canUseListingVacationMode("active"), true)
    assert.equal(canUseListingVacationMode("pending_sale"), true)
  })

  it("rejects draft, sold, and empty statuses", () => {
    assert.equal(canUseListingVacationMode("draft"), false)
    assert.equal(canUseListingVacationMode("sold"), false)
    assert.equal(canUseListingVacationMode("delinquent"), false)
    assert.equal(canUseListingVacationMode(""), false)
    assert.equal(canUseListingVacationMode(null), false)
  })
})
