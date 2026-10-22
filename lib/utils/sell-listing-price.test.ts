import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  applyDraftPublishPrice,
  draftListingPriceBlockReason,
  LISTING_NEEDS_PRICE_BEFORE_LIVE,
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

describe("draftListingPriceBlockReason", () => {
  it("lets a price the form is already showing go live", () => {
    assert.equal(draftListingPriceBlockReason("49.95"), null)
    assert.equal(draftListingPriceBlockReason("$49.95"), null)
    assert.equal(draftListingPriceBlockReason(49.95), null)
  })

  it("blocks a missing or zero price", () => {
    assert.equal(draftListingPriceBlockReason(0), LISTING_NEEDS_PRICE_BEFORE_LIVE)
    assert.equal(draftListingPriceBlockReason(null), LISTING_NEEDS_PRICE_BEFORE_LIVE)
    assert.equal(draftListingPriceBlockReason(""), LISTING_NEEDS_PRICE_BEFORE_LIVE)
  })
})

describe("applyDraftPublishPrice", () => {
  it("uses a typed price when the saved draft is still $0", () => {
    const fields: Record<string, unknown> = { price: "49.95" }
    assert.equal(applyDraftPublishPrice(fields, 0), 49.95)
    assert.equal(fields.price, 49.95)
  })

  it("accepts a dollar sign and thousands separators", () => {
    const fields: Record<string, unknown> = { price: "$1,200.50" }
    assert.equal(applyDraftPublishPrice(fields, null), 1200.5)
    assert.equal(fields.price, 1200.5)
  })

  it("keeps an explicit zero instead of an older price", () => {
    const fields: Record<string, unknown> = { price: 0 }
    assert.equal(applyDraftPublishPrice(fields, 80), 0)
    assert.equal(fields.price, 0)
  })

  it("falls back to the stored price when the submit omits one", () => {
    const fields: Record<string, unknown> = {}
    assert.equal(applyDraftPublishPrice(fields, "49.95"), 49.95)
    assert.equal("price" in fields, false)
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
