import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { applyListingPublicCommerceFields } from "./listing-public-commerce-fields.ts"

describe("applyListingPublicCommerceFields", () => {
  it("replaces cached list price and compare-at with the live row", () => {
    const listing = {
      id: "listing-1",
      title: "6'1 Shalomic",
      price: 10,
      compare_at_price: null,
      status: "active",
    }

    const next = applyListingPublicCommerceFields(listing, {
      price: 275,
      compare_at_price: 10,
      status: "active",
    })

    assert.equal(next.price, 275)
    assert.equal(next.compare_at_price, 10)
    assert.equal(next.status, "active")
    assert.equal(next.title, "6'1 Shalomic")
  })

  it("keeps the cached status when the live row has none", () => {
    const listing = { id: "listing-1", price: 10, status: "active" }
    const next = applyListingPublicCommerceFields(listing, {
      price: 275,
      compare_at_price: null,
      status: null,
    })
    assert.equal(next.status, "active")
  })
})
