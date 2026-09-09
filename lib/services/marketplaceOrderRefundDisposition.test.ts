import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MARKETPLACE_ORDER_REFUND_DISPOSITIONS,
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
})
