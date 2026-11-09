import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  purchaseCountLabel,
  purchaseDetailLine,
  purchaseMatchesQuery,
  purchaseRefundNote,
  purchaseShowsShipping,
  purchaseStatusTone,
  splitPurchaseAmount,
} from "./purchases-list-display.ts"

const row = {
  title: "Paper Girl",
  sellerName: "Beth Macy",
  orderNumber: "89W-FRV",
}

describe("purchase list display", () => {
  it("pluralizes the count", () => {
    assert.equal(purchaseCountLabel(0), "0 purchases")
    assert.equal(purchaseCountLabel(1), "1 purchase")
    assert.equal(purchaseCountLabel(2), "2 purchases")
  })

  it("matches title, seller, and order number", () => {
    assert.equal(purchaseMatchesQuery(row, ""), true)
    assert.equal(purchaseMatchesQuery(row, "  paper "), true)
    assert.equal(purchaseMatchesQuery(row, "macy"), true)
    assert.equal(purchaseMatchesQuery(row, "89w-frv"), true)
    assert.equal(purchaseMatchesQuery(row, "#89W"), true)
    assert.equal(purchaseMatchesQuery(row, "missing"), false)
  })

  it("splits the buyer total into item price and shipping", () => {
    assert.deepEqual(splitPurchaseAmount(15.69, 5.69), { itemAmount: 10, shippingAmount: 5.69 })
    assert.deepEqual(splitPurchaseAmount(4, 0), { itemAmount: 4, shippingAmount: 0 })
    assert.deepEqual(splitPurchaseAmount(4, 9), { itemAmount: 0, shippingAmount: 4 })
    assert.deepEqual(splitPurchaseAmount(Number.NaN, Number.NaN), { itemAmount: 0, shippingAmount: 0 })
  })

  it("builds the detail line from condition and fulfillment", () => {
    assert.equal(purchaseDetailLine("excellent", "Ship to you"), "Excellent")
    assert.equal(purchaseDetailLine("good", "Local pickup"), "Good · Local pickup")
    assert.equal(purchaseDetailLine(null, "Ship to you"), "Ship to you")
    assert.equal(purchaseShowsShipping("Ship to you", 0), true)
    assert.equal(purchaseShowsShipping("Local pickup", 0), false)
    assert.equal(purchaseShowsShipping("Local pickup", 5), true)
  })

  it("keeps refund copy and status color roles", () => {
    assert.equal(purchaseRefundNote("confirmed", 10), null)
    assert.match(purchaseRefundNote("refunding", 10) ?? "", /Refund in progress — \$10\.00/)
    assert.match(purchaseRefundNote("refunded", 4) ?? "", /Refunded — \$4\.00 returned/)
    assert.equal(
      purchaseStatusTone({ label: "Delivered", variant: "default", className: "bg-emerald-600" }),
      "success",
    )
    assert.equal(
      purchaseStatusTone({ label: "Awaiting shipment", variant: "outline", className: "text-amber-950" }),
      "warning",
    )
    assert.equal(purchaseStatusTone({ label: "Refunded", variant: "destructive" }), "danger")
    assert.equal(purchaseStatusTone({ label: "Shipped", variant: "secondary" }), "neutral")
  })
})
