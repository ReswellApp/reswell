import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getSellerEarnings } from "@/lib/seller-fees"
import { computeRestrictedPromoCheckoutAmounts } from "@/lib/utils/promo-product-type"
import {
  buildReswellBucksSettlement,
  ReswellBucksSettlementError,
} from "@/lib/services/reswellBucksSettlement"

function peerLine(itemPrice: number, shippingUsd: number, feeWaived = false) {
  const { marketplaceFee, sellerEarnings } = getSellerEarnings(itemPrice, { feeWaived })
  return {
    listingId: "00000000-0000-4000-8000-000000000001",
    quantity: 1,
    itemPrice,
    shippingUsd,
    platformFee: marketplaceFee,
    sellerEarnings,
  }
}

describe("buildReswellBucksSettlement", () => {
  it("keeps a standard sale in balance", () => {
    const line = peerLine(100, 0)
    const settlement = buildReswellBucksSettlement({
      lines: [line],
      promoDiscountUsd: 0,
      chargedUsd: 100,
    })
    assert.equal(settlement.amountCents, 10000)
    assert.equal(settlement.sellerEarningsCents, 9300)
    assert.equal(settlement.platformFeeCents, 700)
    assert.equal(
      settlement.legs.reduce((sum, leg) => sum + (leg.direction === "debit" ? leg.amountCents : -leg.amountCents), 0),
      0,
    )
  })

  it("holds shipping outside seller earnings", () => {
    const line = peerLine(80, 18.4)
    const settlement = buildReswellBucksSettlement({
      lines: [line],
      promoDiscountUsd: 0,
      chargedUsd: 98.4,
    })
    assert.equal(settlement.shippingCents, 1840)
    assert.equal(
      settlement.amountCents,
      settlement.sellerEarningsCents + settlement.platformFeeCents + settlement.shippingCents,
    )
  })

  it("funds a promo from the platform without shorting the seller", () => {
    const line = peerLine(200, 25)
    const promo = computeRestrictedPromoCheckoutAmounts({
      itemSubtotalUsd: 200,
      eligibleItemSubtotalUsd: 200,
      shippingUsd: 25,
      discountPercent: 15,
    })
    const settlement = buildReswellBucksSettlement({
      lines: [line],
      promoDiscountUsd: promo.discountUsd,
      chargedUsd: promo.totalUsd,
    })
    assert.equal(settlement.promoDiscountCents, 3000)
    assert.equal(settlement.amountCents, 19500)
    assert.equal(settlement.sellerEarningsCents, 18600)
    const debits = settlement.legs
      .filter((leg) => leg.direction === "debit")
      .reduce((sum, leg) => sum + leg.amountCents, 0)
    const credits = settlement.legs
      .filter((leg) => leg.direction === "credit")
      .reduce((sum, leg) => sum + leg.amountCents, 0)
    assert.equal(debits, credits)
  })

  it("pays a fee-waived seller the full item price", () => {
    const line = peerLine(64.5, 0, true)
    const settlement = buildReswellBucksSettlement({
      lines: [line],
      promoDiscountUsd: 0,
      chargedUsd: 64.5,
    })
    assert.equal(settlement.platformFeeCents, 0)
    assert.equal(settlement.sellerEarningsCents, 6450)
    assert.equal(settlement.legs.some((leg) => leg.accountCode === "platform_fee"), false)
  })

  it("rejects a total that does not fund every credit", () => {
    const line = peerLine(40, 10)
    assert.throws(
      () =>
        buildReswellBucksSettlement({
          lines: [line],
          promoDiscountUsd: 0,
          chargedUsd: 40,
        }),
      ReswellBucksSettlementError,
    )
  })
})
