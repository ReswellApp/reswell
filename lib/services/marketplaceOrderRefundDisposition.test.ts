import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MARKETPLACE_ORDER_REFUND_DISPOSITIONS,
  defaultMarketplaceOrderRefundDisposition,
  parseMarketplaceOrderRefundDisposition,
  planMarketplaceOrderRefundSideEffects,
  resolveMarketplaceOrderRefundDisposition,
} from "./marketplaceOrderRefundDisposition.ts"

describe("marketplace order refund disposition", () => {
  it("includes the wrong-item issue refund plan", () => {
    assert.ok(MARKETPLACE_ORDER_REFUND_DISPOSITIONS.includes("item_issue"))
    assert.equal(parseMarketplaceOrderRefundDisposition("item_issue"), "item_issue")
    assert.equal(resolveMarketplaceOrderRefundDisposition("not-a-plan"), "exclusive_relist")
  })

  it("holds the listing offline and does not void the outbound label", () => {
    const plan = planMarketplaceOrderRefundSideEffects("item_issue")
    assert.deepEqual(plan, {
      disposition: "item_issue",
      listingVisibility: "vacation",
      grantExclusiveBuyerWindow: false,
      notifyExclusiveRepurchase: false,
      voidUnusedOutboundLabel: false,
    })
  })

  it("refunds an uncollected local pickup without voiding a label", () => {
    assert.ok(MARKETPLACE_ORDER_REFUND_DISPOSITIONS.includes("cancel_uncollected"))
    assert.deepEqual(planMarketplaceOrderRefundSideEffects("cancel_uncollected"), {
      disposition: "cancel_uncollected",
      listingVisibility: "vacation",
      grantExclusiveBuyerWindow: false,
      notifyExclusiveRepurchase: false,
      voidUnusedOutboundLabel: false,
    })
  })

  it("defaults the admin picker to never-picked-up for open pickup orders", () => {
    assert.equal(
      defaultMarketplaceOrderRefundDisposition({
        fulfillmentMethod: "pickup",
        deliveryStatus: "pending",
      }),
      "cancel_uncollected",
    )
    assert.equal(
      defaultMarketplaceOrderRefundDisposition({
        fulfillmentMethod: "pickup",
        deliveryStatus: "pickup_ready",
      }),
      "cancel_uncollected",
    )
    assert.equal(
      defaultMarketplaceOrderRefundDisposition({
        fulfillmentMethod: "pickup",
        deliveryStatus: "picked_up",
      }),
      "exclusive_relist",
    )
    assert.equal(
      defaultMarketplaceOrderRefundDisposition({ fulfillmentMethod: "shipping" }),
      "exclusive_relist",
    )
    assert.equal(
      defaultMarketplaceOrderRefundDisposition({
        fulfillmentMethod: "local_pickup",
        deliveryStatus: "pending",
      }),
      "cancel_uncollected",
    )
  })
})
