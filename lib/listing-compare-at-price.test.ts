import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  coerceListingPriceUsd,
  listingFieldsWithCoercedPrice,
} from "./listing-compare-at-price"

describe("coerceListingPriceUsd", () => {
  it("reads the price the sell form actually submits", () => {
    assert.equal(coerceListingPriceUsd("85"), 85)
    assert.equal(coerceListingPriceUsd("1,200.50"), 1200.5)
    assert.equal(coerceListingPriceUsd("$40"), 40)
    assert.equal(coerceListingPriceUsd(75), 75)
  })

  it("rejects an empty or zero price", () => {
    assert.equal(coerceListingPriceUsd(""), null)
    assert.equal(coerceListingPriceUsd("0"), null)
    assert.equal(coerceListingPriceUsd("nope"), null)
  })
})

describe("listingFieldsWithCoercedPrice", () => {
  it("turns the typed price into a number so draft publish does not keep the empty saved price", () => {
    const fields = listingFieldsWithCoercedPrice({ price: "85", title: "FCS Reactor" })
    const price = typeof fields.price === "number" ? fields.price : 0
    assert.equal(price, 85)
    assert.equal(listingFieldsWithCoercedPrice({ price: "" }).price, "")
    assert.equal(listingFieldsWithCoercedPrice({ price: "1,200" }).price, 1200)
  })
})
