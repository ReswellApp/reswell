import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { listingStatusAcceptsOffers } from "./listing-offer-eligibility.ts"

describe("listingStatusAcceptsOffers", () => {
  it("allows active and pending_sale", () => {
    assert.equal(listingStatusAcceptsOffers("active"), true)
    assert.equal(listingStatusAcceptsOffers("pending_sale"), true)
  })

  it("rejects sold, removed, draft, and other ended statuses", () => {
    assert.equal(listingStatusAcceptsOffers("sold"), false)
    assert.equal(listingStatusAcceptsOffers("removed"), false)
    assert.equal(listingStatusAcceptsOffers("draft"), false)
    assert.equal(listingStatusAcceptsOffers("delinquent"), false)
    assert.equal(listingStatusAcceptsOffers("pending"), false)
  })

  it("rejects missing status so UI does not assume offerability", () => {
    assert.equal(listingStatusAcceptsOffers(null), false)
    assert.equal(listingStatusAcceptsOffers(undefined), false)
    assert.equal(listingStatusAcceptsOffers(""), false)
  })
})
