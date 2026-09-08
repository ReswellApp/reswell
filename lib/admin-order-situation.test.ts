import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { adminFulfillmentLabel, adminOrderSituation, adminPaymentLabel } from "./admin-order-situation.ts"

describe("adminPaymentLabel", () => {
  it("maps known methods", () => {
    assert.equal(adminPaymentLabel("stripe"), "Card")
    assert.equal(adminPaymentLabel("reswell_bucks"), "Wallet")
    assert.equal(adminPaymentLabel("cash"), "Cash")
  })
})

describe("adminFulfillmentLabel", () => {
  it("maps shipping and pickup", () => {
    assert.equal(adminFulfillmentLabel("shipping"), "Shipping")
    assert.equal(adminFulfillmentLabel("pickup"), "Local pickup")
    assert.equal(adminFulfillmentLabel(null), "—")
  })
})

describe("adminOrderSituation", () => {
  it("flags unpaid and refund states first", () => {
    assert.equal(adminOrderSituation({ status: "pending", fulfillment_method: "shipping", delivery_status: "pending" }).label, "Unpaid")
    assert.equal(
      adminOrderSituation({ status: "refunding", fulfillment_method: "shipping", delivery_status: "pending" }).needsAttention,
      true,
    )
    assert.equal(adminOrderSituation({ status: "refunded", fulfillment_method: "shipping", delivery_status: "pending" }).label, "Refunded")
  })

  it("asks admins to fulfill shop orders", () => {
    const situation = adminOrderSituation({
      status: "confirmed",
      fulfillment_method: "shipping",
      delivery_status: "pending",
      canFulfillReswellShop: true,
    })
    assert.equal(situation.label, "Fulfill shop order")
    assert.equal(situation.needsAttention, true)
  })

  it("explains pickup waiting vs complete", () => {
    const waiting = adminOrderSituation({
      status: "confirmed",
      fulfillment_method: "pickup",
      delivery_status: "pickup_ready",
      pickup_code: "123456",
    })
    assert.equal(waiting.label, "Waiting for pickup")
    assert.match(waiting.nextStep, /123456/)

    const done = adminOrderSituation({
      status: "confirmed",
      fulfillment_method: "pickup",
      delivery_status: "picked_up",
    })
    assert.equal(done.label, "Picked up")
    assert.equal(done.needsAttention, false)
  })

  it("splits shipping into needs label, ready, in transit, and delivered", () => {
    const needsLabel = adminOrderSituation({
      status: "confirmed",
      fulfillment_method: "shipping",
      delivery_status: "pending",
    })
    assert.equal(needsLabel.label, "Needs label")
    assert.equal(needsLabel.needsAttention, true)

    const ready = adminOrderSituation({
      status: "confirmed",
      fulfillment_method: "shipping",
      delivery_status: "pending",
      has_prepared_label: true,
    })
    assert.equal(ready.label, "Ready to ship")

    const transit = adminOrderSituation({
      status: "confirmed",
      fulfillment_method: "shipping",
      delivery_status: "shipped",
      tracking_number: "1Z999",
      tracking_carrier: "UPS",
    })
    assert.equal(transit.label, "In transit")
    assert.match(transit.nextStep, /UPS/)

    const delivered = adminOrderSituation({
      status: "confirmed",
      fulfillment_method: "shipping",
      delivery_status: "delivered",
      payout: { status: "held", hold_reason: "awaiting_carrier_settlement", released_at: null },
    })
    assert.equal(delivered.label, "Delivered")
    assert.match(delivered.nextStep, /24 hours/)
  })

  it("flags legacy manual payout after delivery", () => {
    const situation = adminOrderSituation({
      status: "confirmed",
      fulfillment_method: "shipping",
      delivery_status: "delivered",
      payout: { status: "held", hold_reason: "awaiting_manual_release", released_at: null },
    })
    assert.equal(situation.nextStep, "Approve seller payout")
    assert.equal(situation.needsAttention, true)
    assert.equal(situation.tone, "amber")
  })
})
