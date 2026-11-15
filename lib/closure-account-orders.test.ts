import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  payoutFundsAreReleased,
  purchaseNeedsClosureAttention,
  returnStillOpen,
  saleNeedsClosureAttention,
} from "./closure-account-orders.ts"

const openReturn = { hasReturn: true, isPartial: false, allReturnsRefunded: false }
const refundedReturn = { hasReturn: true, isPartial: false, allReturnsRefunded: true }

describe("closure account orders", () => {
  it("treats paid and released pending payouts as released", () => {
    assert.equal(payoutFundsAreReleased(null), false)
    assert.equal(payoutFundsAreReleased({ status: "held", released_at: null }), false)
    assert.equal(payoutFundsAreReleased({ status: "pending", released_at: null }), false)
    assert.equal(
      payoutFundsAreReleased({ status: "pending", released_at: "2026-11-01T00:00:00.000Z" }),
      true,
    )
    assert.equal(payoutFundsAreReleased({ status: "processing", released_at: null }), true)
    assert.equal(payoutFundsAreReleased({ status: "paid", released_at: null }), true)
  })

  it("keeps a sale while it still needs delivery or an earnings release", () => {
    assert.equal(
      saleNeedsClosureAttention({
        orderStatus: "confirmed",
        deliveryStatus: "shipped",
        payoutReleased: false,
        returnInProgress: false,
      }),
      true,
    )
    assert.equal(
      saleNeedsClosureAttention({
        orderStatus: "confirmed",
        deliveryStatus: "delivered",
        payoutReleased: false,
        returnInProgress: false,
      }),
      true,
    )
    assert.equal(
      saleNeedsClosureAttention({
        orderStatus: "confirmed",
        deliveryStatus: "picked_up",
        payoutReleased: true,
        returnInProgress: false,
      }),
      false,
    )
    assert.equal(
      saleNeedsClosureAttention({
        orderStatus: "refunded",
        deliveryStatus: "pending",
        payoutReleased: false,
        returnInProgress: false,
      }),
      false,
    )
    assert.equal(
      saleNeedsClosureAttention({
        orderStatus: "confirmed",
        deliveryStatus: "delivered",
        payoutReleased: true,
        returnInProgress: returnStillOpen(openReturn),
      }),
      true,
    )
    assert.equal(returnStillOpen(refundedReturn), false)
  })

  it("keeps a purchase until delivery, and hides it once earnings are the seller's concern", () => {
    assert.equal(
      purchaseNeedsClosureAttention({
        orderStatus: "confirmed",
        deliveryStatus: "pending",
        payoutReleased: false,
        returnInProgress: false,
      }),
      true,
    )
    assert.equal(
      purchaseNeedsClosureAttention({
        orderStatus: "confirmed",
        deliveryStatus: "delivered",
        payoutReleased: false,
        returnInProgress: false,
      }),
      false,
    )
    assert.equal(
      purchaseNeedsClosureAttention({
        orderStatus: "refunding",
        deliveryStatus: "delivered",
        payoutReleased: true,
        returnInProgress: false,
      }),
      true,
    )
  })
})
