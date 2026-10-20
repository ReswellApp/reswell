import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  parseSellListingPrice,
  readLiveSellListingPrice,
  sellListingPriceIsPublishable,
  sellListingPriceValidationMessage,
} from "./sell-listing-price.ts"

describe("parseSellListingPrice", () => {
  it("accepts a plain amount, a dollar sign, and thousands separators", () => {
    assert.equal(parseSellListingPrice("450"), 450)
    assert.equal(parseSellListingPrice("$450"), 450)
    assert.equal(parseSellListingPrice("$1,200.50"), 1200.5)
    assert.equal(parseSellListingPrice(" 1,200 "), 1200)
    assert.equal(parseSellListingPrice(450), 450)
  })

  it("rejects empty and non-numeric text", () => {
    assert.equal(parseSellListingPrice(""), null)
    assert.equal(parseSellListingPrice("$"), null)
    assert.equal(parseSellListingPrice("abc"), null)
    assert.equal(parseSellListingPrice("12abc"), null)
  })
})

describe("sellListingPriceValidationMessage", () => {
  it("asks for a price when the field is empty", () => {
    assert.equal(sellListingPriceValidationMessage(""), "Enter a listing price.")
    assert.equal(sellListingPriceValidationMessage("$"), "Enter a listing price.")
  })

  it("accepts a formatted price that looks filled in", () => {
    assert.equal(sellListingPriceValidationMessage("$1,200"), null)
    assert.equal(sellListingPriceIsPublishable("$450"), true)
  })

  it("rejects an out-of-range amount", () => {
    assert.match(sellListingPriceValidationMessage("0") ?? "", /valid price/i)
    assert.equal(sellListingPriceIsPublishable("0"), false)
  })
})

describe("readLiveSellListingPrice", () => {
  it("keeps a parsed state value", () => {
    assert.equal(readLiveSellListingPrice("$450"), "$450")
  })

  it("returns empty state when no input is mounted", () => {
    assert.equal(readLiveSellListingPrice(""), "")
  })
})
