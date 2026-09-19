import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { priceGuideOrderSoldUsd } from "./sold-item-price.ts"

describe("priceGuideOrderSoldUsd", () => {
  it("uses the sold item price and excludes buyer-paid shipping", () => {
    assert.equal(priceGuideOrderSoldUsd({ amount: 985, shipping_amount: 85 }), 900)
  })

  it("keeps the full amount when shipping is zero or missing", () => {
    assert.equal(priceGuideOrderSoldUsd({ amount: 650, shipping_amount: 0 }), 650)
    assert.equal(priceGuideOrderSoldUsd({ amount: 650 }), 650)
  })

  it("returns null when there is no merchandise price", () => {
    assert.equal(priceGuideOrderSoldUsd({ amount: 40, shipping_amount: 85 }), null)
    assert.equal(priceGuideOrderSoldUsd({ amount: null, shipping_amount: 25 }), null)
  })
})
