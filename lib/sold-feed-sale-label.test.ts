import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  soldFeedSalePriceLabel,
  soldFeedShowsSaleQuantity,
  soldFeedTilePrice,
} from "@/lib/sold-feed-sale-label"

describe("sold feed sale line labels", () => {
  it("shows quantity only when the checkout sold more than one unit", () => {
    assert.equal(soldFeedShowsSaleQuantity(2), true)
    assert.equal(soldFeedSalePriceLabel(2, 41.98, true), "Sold 2 for $41.98")
    assert.equal(soldFeedTilePrice(20.99, 2, 41.98), 41.98)
  })

  it("uses the standard single-unit line for one unit", () => {
    assert.equal(soldFeedShowsSaleQuantity(1), false)
    assert.equal(soldFeedSalePriceLabel(1, 20.99, false), "Sold for $20.99")
    assert.equal(soldFeedTilePrice(750, 1, 700), 750)
  })
})
