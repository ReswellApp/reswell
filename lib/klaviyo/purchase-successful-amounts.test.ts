import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { purchaseSuccessfulOrderAmounts } from "./purchase-successful-amounts.ts"

describe("purchaseSuccessfulOrderAmounts", () => {
  it("matches the order page split for a promo shipping sale", () => {
    const amounts = purchaseSuccessfulOrderAmounts({
      orderTotalUsd: 44.03,
      shippingAmountUsd: 5.78,
      platformFeeUsd: 3.15,
      sellerEarningsUsd: 41.85,
    })

    assert.equal(amounts.listingPrice, 38.25)
    assert.equal(amounts.orderTotal, 44.03)
    assert.equal(amounts.shippingPaidByBuyer, 5.78)
    assert.equal(amounts.platformFee, 3.15)
    assert.equal(amounts.sellerEarnings, 41.85)
  })

  it("treats a missing shipping amount as zero", () => {
    const amounts = purchaseSuccessfulOrderAmounts({
      orderTotalUsd: 45,
      sellerEarningsUsd: 41.85,
      platformFeeUsd: 3.15,
    })

    assert.equal(amounts.listingPrice, 45)
    assert.equal(amounts.shippingPaidByBuyer, 0)
  })
})
