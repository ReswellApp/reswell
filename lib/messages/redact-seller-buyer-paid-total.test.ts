import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { sellerOrderPlacedMessageWithoutBuyerPaid } from "./redact-seller-buyer-paid-total.ts"

const orderId = "11111111-1111-4111-8111-111111111111"

describe("sellerOrderPlacedMessageWithoutBuyerPaid", () => {
  it("replaces the discounted buyer charge with the seller sale total", () => {
    const message = sellerOrderPlacedMessageWithoutBuyerPaid(
      {
        content: `Order #V6F8W6 — $9.92 total\n\nItem: "Futures CI Upright Fins Medium"\nPaid with card`,
        metadata: {
          kind: "order_placed",
          orderId,
          orderNum: "V6F8W6",
          listingTitle: "Futures CI Upright Fins Medium",
          total: 9.92,
          fulfillment: "shipping",
          paymentMethod: "card",
        },
      },
      114.92,
      9.92,
    )

    assert.equal(message.content.includes("$9.92"), false)
    assert.match(String(message.content), /\$114\.92 total/)
    assert.equal((message.metadata as { total: number }).total, 114.92)
  })

  it("leaves a full-price order unchanged", () => {
    const original = {
      content: "Order #V6F8W6 — $114.92 total",
      metadata: {
        kind: "order_placed" as const,
        orderId,
        orderNum: "V6F8W6",
        listingTitle: "Futures CI Upright Fins Medium",
        total: 114.92,
        fulfillment: "shipping" as const,
        paymentMethod: "card" as const,
      },
    }

    const message = sellerOrderPlacedMessageWithoutBuyerPaid(original, 114.92, 114.92)
    assert.equal(message, original)
  })
})
