import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  SELLER_SALE_TIP_PI_PURPOSE,
  buildSellerSaleTipPaymentIntentCreateParams,
  isSellerSaleTipPaymentIntent,
  sellerSaleTipCreateParamsKeepFundsOnPlatform,
  sellerSaleTipPaymentIntentRoutesToSeller,
} from "./seller-sale-tip-intent.ts"

const baseInput = {
  amountCents: 1500,
  listingId: "listing-1",
  sellerUserId: "seller-1",
  listingTitle: "6'2 Twin",
  sellerEmail: "seller@example.com",
}

describe("buildSellerSaleTipPaymentIntentCreateParams", () => {
  it("keeps the charge on the platform account (no seller transfer)", () => {
    const params = buildSellerSaleTipPaymentIntentCreateParams(baseInput)
    assert.equal(sellerSaleTipCreateParamsKeepFundsOnPlatform(params), true)
    assert.equal(params.metadata.purpose, SELLER_SALE_TIP_PI_PURPOSE)
    assert.equal("buyer_id" in params.metadata, false)
    assert.equal("transfer_data" in params, false)
    assert.equal("on_behalf_of" in params, false)
    assert.equal("application_fee_amount" in params, false)
  })

  it("omits receipt email when blank", () => {
    const params = buildSellerSaleTipPaymentIntentCreateParams({
      ...baseInput,
      sellerEmail: "  ",
    })
    assert.equal("receipt_email" in params, false)
  })
})

describe("isSellerSaleTipPaymentIntent", () => {
  it("matches only seller_sale_tip purpose", () => {
    assert.equal(
      isSellerSaleTipPaymentIntent({ metadata: { purpose: SELLER_SALE_TIP_PI_PURPOSE } }),
      true,
    )
    assert.equal(isSellerSaleTipPaymentIntent({ metadata: { purpose: "marketplace" } }), false)
    assert.equal(isSellerSaleTipPaymentIntent({ metadata: {} }), false)
  })
})

describe("sellerSaleTipPaymentIntentRoutesToSeller", () => {
  it("detects destination charges that would hit seller earnings", () => {
    assert.equal(sellerSaleTipPaymentIntentRoutesToSeller({}), false)
    assert.equal(
      sellerSaleTipPaymentIntentRoutesToSeller({
        transfer_data: { destination: "acct_seller" },
      }),
      true,
    )
    assert.equal(
      sellerSaleTipPaymentIntentRoutesToSeller({ on_behalf_of: "acct_seller" }),
      true,
    )
  })
})
