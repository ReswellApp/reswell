import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  computeBuyerCreditEarnCents,
  computeMaxReswellCreditApplyCents,
  computeSellerCreditEarnCents,
  creditCentsToUsd,
  usdToCreditCents,
} from "@/lib/reswell-credit-rates"

describe("reswell credit rates", () => {
  it("converts usd and cents", () => {
    assert.equal(usdToCreditCents(12.34), 1234)
    assert.equal(creditCentsToUsd(1234), 12.34)
  })

  it("earns 2% on buys and 3% on sells", () => {
    assert.equal(computeBuyerCreditEarnCents(100), 200)
    assert.equal(computeSellerCreditEarnCents(100), 300)
  })

  it("caps apply at 50% of items, balance, and stripe min card charge", () => {
    assert.equal(
      computeMaxReswellCreditApplyCents({
        itemSubtotalUsd: 100,
        shippingUsd: 20,
        promoDiscountUsd: 0,
        availableCreditCents: 100_000,
      }),
      5000,
    )

    assert.equal(
      computeMaxReswellCreditApplyCents({
        itemSubtotalUsd: 100,
        shippingUsd: 0,
        promoDiscountUsd: 0,
        availableCreditCents: 1200,
      }),
      1200,
    )

    // $0.80 item → half is $0.40, but card min leaves only $0.30 room
    assert.equal(
      computeMaxReswellCreditApplyCents({
        itemSubtotalUsd: 0.8,
        shippingUsd: 0,
        promoDiscountUsd: 0,
        availableCreditCents: 10_000,
      }),
      30,
    )
  })
})
