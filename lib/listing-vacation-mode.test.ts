import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  canUseListingVacationMode,
  listingIsOnVacation,
} from "./listing-vacation-mode.ts"

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

describe("listingIsOnVacation", () => {
  it("is true only for live listings that are hidden", () => {
    assert.equal(listingIsOnVacation({ status: "active", hiddenFromSite: true }), true)
    assert.equal(listingIsOnVacation({ status: "pending_sale", hiddenFromSite: true }), true)
  })

  it("is false for visible live listings and hidden drafts", () => {
    assert.equal(listingIsOnVacation({ status: "active", hiddenFromSite: false }), false)
    assert.equal(listingIsOnVacation({ status: "draft", hiddenFromSite: true }), false)
    assert.equal(listingIsOnVacation({ status: "sold", hiddenFromSite: true }), false)
  })
})
