import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  adminOrderShowsShippingLabel,
  adminShippingLabelMessageLinks,
} from "./admin-order-label-visibility.ts"

const ORDER_ID = "7f3c1a90-4e2b-4d8a-9f11-2c6e8b4a1d05"

describe("adminOrderShowsShippingLabel", () => {
  it("shows a paid PDF on a shipping order", () => {
    assert.equal(
      adminOrderShowsShippingLabel({
        fulfillmentMethod: "shipping",
        hasPdf: true,
        hasPaperlessQr: false,
      }),
      true,
    )
  })

  it("shows a paperless QR when the seller-facing PDF link was removed", () => {
    assert.equal(
      adminOrderShowsShippingLabel({
        fulfillmentMethod: "shipping",
        hasPdf: false,
        hasPaperlessQr: true,
      }),
      true,
    )
  })

  it("stays hidden when nothing was purchased", () => {
    assert.equal(
      adminOrderShowsShippingLabel({
        fulfillmentMethod: "shipping",
        hasPdf: false,
        hasPaperlessQr: false,
      }),
      false,
    )
  })

  it("stays hidden for pickup orders", () => {
    assert.equal(
      adminOrderShowsShippingLabel({
        fulfillmentMethod: "pickup",
        hasPdf: true,
        hasPaperlessQr: true,
      }),
      false,
    )
  })
})

describe("adminShippingLabelMessageLinks", () => {
  it("points staff at the order label file instead of the stripped carrier URL", () => {
    assert.deepEqual(adminShippingLabelMessageLinks(ORDER_ID), {
      downloadHref: `/api/admin/orders/${ORDER_ID}/shipping-label/download`,
      viewHref: `/api/admin/orders/${ORDER_ID}/shipping-label/download?inline=1`,
    })
  })

  it("returns null without an order id", () => {
    assert.equal(adminShippingLabelMessageLinks("  "), null)
    assert.equal(adminShippingLabelMessageLinks(null), null)
  })
})
