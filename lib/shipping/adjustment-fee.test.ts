import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  adjustmentDisputeReasonLabel,
  inferAdjustmentCarrier,
  sellerAdjustmentFeeExplanation,
} from "./adjustment-fee.ts"

describe("inferAdjustmentCarrier", () => {
  it("reads UPS, FedEx, and USPS from the service name", () => {
    assert.equal(inferAdjustmentCarrier("UPS Ground"), "ups")
    assert.equal(inferAdjustmentCarrier("FedEx Home Delivery"), "fedex")
    assert.equal(inferAdjustmentCarrier(null, "USPS Priority Mail"), "usps")
  })

  it("leaves an unknown service unmatched", () => {
    assert.equal(inferAdjustmentCarrier("Daylight Transport"), null)
  })
})

describe("sellerAdjustmentFeeExplanation", () => {
  it("states the buyer label payment and the deducted fee", () => {
    const copy = sellerAdjustmentFeeExplanation({
      amountUsd: 170.73,
      buyerShippingUsd: 137.3,
      lengthIn: 78,
      widthIn: 18,
      heightIn: 6,
    })
    assert.match(copy, /\$170\.73/)
    assert.match(copy, /\$137\.30/)
    assert.match(copy, /deducted from your balance/)
    assert.match(copy, /78 × 18 × 6 in/)
  })
})

describe("adjustmentDisputeReasonLabel", () => {
  it("names the carrier on each dispute reason", () => {
    assert.equal(
      adjustmentDisputeReasonLabel("ups", "dimensions_match_label"),
      "Packed size matched the UPS label",
    )
    assert.equal(
      adjustmentDisputeReasonLabel("fedex", "duplicate_charge"),
      "FedEx billed this adjustment more than once",
    )
    assert.equal(
      adjustmentDisputeReasonLabel("usps", "wrong_package"),
      "USPS measured a different package",
    )
  })
})
