import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  soldFeedSalePriceLabel,
  soldFeedShowsSaleQuantity,
  soldFeedTilePrice,
} from "@/lib/sold-feed-sale-label"

describe("sold feed quantity tiles", () => {
  it("shows how many sold together without using the single-unit label", () => {
    assert.equal(soldFeedShowsSaleQuantity({ quantity: 2, listingStillInStock: true }), true)
    assert.equal(soldFeedSalePriceLabel(2, 41.98, true), "Sold 2 for $41.98")
    assert.equal(soldFeedTilePrice(20.99, 2, 41.98), 41.98)
  })

  it("shows a count of one while the listing still has inventory", () => {
    assert.equal(soldFeedShowsSaleQuantity({ quantity: 1, listingStillInStock: true }), true)
    assert.equal(soldFeedSalePriceLabel(1, 20.99, true), "Sold 1 for $20.99")
  })

  it("leaves a one-off sold listing on the original price line", () => {
    assert.equal(soldFeedShowsSaleQuantity({ quantity: 1, listingStillInStock: false }), false)
    assert.equal(soldFeedSalePriceLabel(1, 750, false), "Sold for $750.00")
    assert.equal(soldFeedTilePrice(750, 1, 700), 750)
  })
})
