import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveSellerOrderDisplayAmounts } from "./seller-order-display-amounts.ts"

describe("resolveSellerOrderDisplayAmounts", () => {
  it("keeps the seller sale total at the listing price when a promo cuts what the buyer paid", () => {
    const amounts = resolveSellerOrderDisplayAmounts({
      amount: 9.92,
      shipping_amount: 9.92,
      platform_fee: 7.35,
      seller_earnings: 97.65,
      promo_discount_usd: 105,
    })

    assert.equal(amounts.hadReswellPromo, true)
    assert.equal(amounts.buyerPaidTotal, 9.92)
    assert.equal(amounts.itemPriceAmount, 105)
    assert.equal(amounts.sellerSaleTotal, 114.92)
    assert.notEqual(amounts.sellerSaleTotal, amounts.buyerPaidTotal)
  })

  it("matches the buyer charge when no promo was used", () => {
    const amounts = resolveSellerOrderDisplayAmounts({
      amount: 114.92,
      shipping_amount: 9.92,
      platform_fee: 7.35,
      seller_earnings: 97.65,
      promo_discount_usd: 0,
    })

    assert.equal(amounts.hadReswellPromo, false)
    assert.equal(amounts.sellerSaleTotal, amounts.buyerPaidTotal)
  })
})
