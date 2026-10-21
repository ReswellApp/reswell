import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildPurchaseDetailTimeline,
  purchaseDetailStatusDate,
} from "./purchase-detail-timeline.ts"

const createdAt = "2026-08-13T15:16:00.000Z"

describe("purchase detail timeline", () => {
  it("shows purchase, seller ship, and delivery before a carrier scan exists", () => {
    const steps = buildPurchaseDetailTimeline({
      createdAt,
      fulfillmentMethod: "shipping",
      deliveryStatus: "pending",
      orderStatus: "confirmed",
      hasTrackingNumber: false,
      carrierName: null,
      events: [],
      actualDeliveryAt: null,
      refundedAt: null,
    })
    assert.deepEqual(
      steps.map((step) => [step.title, step.state]),
      [
        ["Purchased", "done"],
        ["Waiting for the seller to ship", "current"],
        ["Delivered", "upcoming"],
      ],
    )
  })

  it("plays carrier scans oldest first and keeps the purchase at the top", () => {
    const steps = buildPurchaseDetailTimeline({
      createdAt,
      fulfillmentMethod: "shipping",
      deliveryStatus: "delivered",
      orderStatus: "confirmed",
      hasTrackingNumber: true,
      carrierName: "USPS",
      events: [
        { occurred_at: "2026-08-21T17:03:00.000Z", description: "Delivered" },
        { occurred_at: "2026-08-14T13:03:00.000Z", description: "Accepted by USPS" },
      ],
      actualDeliveryAt: "2026-08-21T17:03:00.000Z",
      refundedAt: null,
    })
    assert.deepEqual(
      steps.map((step) => step.title),
      ["Purchased", "Seller marked shipped", "Accepted by USPS", "Delivered"],
    )
    assert.equal(steps[2]?.occurredAt, "2026-08-14T13:03:00.000Z")
  })

  it("adds a delivered step when scans never say delivered", () => {
    const steps = buildPurchaseDetailTimeline({
      createdAt,
      fulfillmentMethod: "shipping",
      deliveryStatus: "delivered",
      orderStatus: "confirmed",
      hasTrackingNumber: true,
      carrierName: "UPS",
      events: [{ occurred_at: "2026-08-14T13:03:00.000Z", description: "In transit" }],
      actualDeliveryAt: "2026-08-21T17:03:00.000Z",
      refundedAt: null,
    })
    assert.equal(steps.at(-1)?.title, "Delivered")
    assert.equal(steps.at(-1)?.occurredAt, "2026-08-21T17:03:00.000Z")
  })

  it("uses pickup and refund milestones", () => {
    const pickup = buildPurchaseDetailTimeline({
      createdAt,
      fulfillmentMethod: "pickup",
      deliveryStatus: "picked_up",
      orderStatus: "confirmed",
      hasTrackingNumber: false,
      carrierName: null,
      events: [],
      actualDeliveryAt: null,
      refundedAt: null,
    })
    assert.deepEqual(
      pickup.map((step) => step.title),
      ["Purchased", "Picked up"],
    )

    const refunded = buildPurchaseDetailTimeline({
      createdAt,
      fulfillmentMethod: "shipping",
      deliveryStatus: "pending",
      orderStatus: "refunded",
      hasTrackingNumber: false,
      carrierName: null,
      events: [],
      actualDeliveryAt: null,
      refundedAt: "2026-08-20T12:00:00.000Z",
    })
    assert.equal(refunded.at(-1)?.title, "Refunded")
    assert.equal(refunded.at(-1)?.occurredAt, "2026-08-20T12:00:00.000Z")
  })

  it("does not treat the purchase date as a delivery date", () => {
    assert.equal(
      purchaseDetailStatusDate({
        deliveryStatus: "delivered",
        orderStatus: "confirmed",
        createdAt,
        actualDeliveryAt: "2026-08-21T17:03:00.000Z",
        refundedAt: null,
      }),
      "2026-08-21T17:03:00.000Z",
    )
    assert.equal(
      purchaseDetailStatusDate({
        deliveryStatus: "delivered",
        orderStatus: "confirmed",
        createdAt,
        actualDeliveryAt: null,
        refundedAt: null,
      }),
      null,
    )
    assert.equal(
      purchaseDetailStatusDate({
        deliveryStatus: "pending",
        orderStatus: "confirmed",
        createdAt,
        actualDeliveryAt: null,
        refundedAt: null,
      }),
      createdAt,
    )
  })
})
