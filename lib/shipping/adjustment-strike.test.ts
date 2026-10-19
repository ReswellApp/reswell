import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  coveredShippingAdjustmentMessage,
  shippingAdjustmentEarningsDeduction,
  shippingAdjustmentSellerCopy,
  shippingAdjustmentWalletTake,
} from "./adjustment-strike.ts"

describe("shippingAdjustmentEarningsDeduction", () => {
  it("caps the deduction at the earnings on the sale", () => {
    assert.equal(shippingAdjustmentEarningsDeduction(400, 196.4), 196.4)
    assert.equal(shippingAdjustmentEarningsDeduction(50, 196.4), 50)
    assert.equal(shippingAdjustmentEarningsDeduction(0, 196.4), 0)
  })
})

describe("shippingAdjustmentWalletTake", () => {
  it("never takes more cash than is available", () => {
    assert.equal(shippingAdjustmentWalletTake(80, 196.4), 80)
    assert.equal(shippingAdjustmentWalletTake(0, 40), 0)
    assert.equal(shippingAdjustmentWalletTake(-12, 40), 0)
  })
})

describe("covered shipping adjustment copy", () => {
  it("tells the seller this one is covered and the next one comes out of the sale", () => {
    const message = coveredShippingAdjustmentMessage(196.4)
    assert.match(message, /\$196\.40/)
    assert.match(message, /covering this one/)
    assert.match(message, /next adjustment on a shipped item/)
    assert.match(message, /deducted from your total earnings on that sale/)
  })

  it("uses the covered message for the Klaviyo event", () => {
    const copy = shippingAdjustmentSellerCopy({
      coverage: "covered_strike",
      amountUsd: 18.5,
      earningsDeductedUsd: 0,
      listingTitle: "6'2 Twinzer",
    })
    assert.match(copy.headline, /covered/)
    assert.match(copy.message, /6'2 Twinzer/)
    assert.match(copy.message, /covering this one/)
  })

  it("uses the earnings deduction message after the strike is used", () => {
    const copy = shippingAdjustmentSellerCopy({
      coverage: "charged_to_earnings",
      amountUsd: 40,
      earningsDeductedUsd: 40,
      listingTitle: "Fish",
    })
    assert.match(copy.message, /\$40\.00 was deducted from your earnings on this sale/)
  })
})
