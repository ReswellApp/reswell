import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  saleCountLabel,
  saleDetailLine,
  saleMatchesQuery,
  saleRefundNote,
} from "./sales-list-display.ts"

describe("sales list display", () => {
  it("pluralizes the count", () => {
    assert.equal(saleCountLabel(0), "0 sales")
    assert.equal(saleCountLabel(1), "1 sale")
    assert.equal(saleCountLabel(4), "4 sales")
  })

  it("matches title, buyer, and order number", () => {
    const row = { title: "Nose Fish", buyerName: "UCTeeth", orderNumber: "9H4MH4" }
    assert.equal(saleMatchesQuery(row, ""), true)
    assert.equal(saleMatchesQuery(row, "fish"), true)
    assert.equal(saleMatchesQuery(row, "ucteeth"), true)
    assert.equal(saleMatchesQuery(row, "#9h4"), true)
    assert.equal(saleMatchesQuery(row, "missing"), false)
  })

  it("builds the detail line and keeps drop-off visible", () => {
    assert.equal(saleDetailLine("excellent", "Ship to buyer", false), "Excellent")
    assert.equal(saleDetailLine("good", "Local pickup", false), "Good · Local pickup")
    assert.equal(
      saleDetailLine("excellent", "Ship to buyer", true),
      "Excellent · Santa Barbara drop-off",
    )
  })

  it("writes refund copy for the seller", () => {
    assert.equal(saleRefundNote("confirmed", 10), null)
    assert.match(saleRefundNote("refunding", 12.5) ?? "", /returning to the buyer/)
    assert.match(saleRefundNote("refunded", 4) ?? "", /returned to the buyer/)
  })
})
