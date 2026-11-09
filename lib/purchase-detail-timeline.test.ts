import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildPurchaseDetailTimeline,
  purchaseDetailStatusDate,
} from "./purchase-detail-timeline.ts"

const createdAt = "2026-08-13T15:16:00.000Z"

describe("purchase detail timeline", () => {
  it("shows purchase and a waiting step before a label exists", () => {
    const steps = buildPurchaseDetailTimeline({
      createdAt,
      fulfillmentMethod: "shipping",
      deliveryStatus: "pending",
      orderStatus: "confirmed",
      hasTrackingNumber: false,
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
      events: [
        { occurred_at: "2026-08-21T17:03:00.000Z", description: "Delivered" },
        { occurred_at: "2026-08-14T13:03:00.000Z", description: "Accepted by USPS" },
      ],
      actualDeliveryAt: "2026-08-21T17:03:00.000Z",
      refundedAt: null,
    })
    assert.deepEqual(
      steps.map((step) => step.title),
      [
        "Purchased",
        "Shipping Label Created",
        "Seller marked shipped",
        "Accepted by USPS",
        "Delivered",
      ],
    )
    assert.equal(steps[2]?.occurredAt, "2026-08-14T13:03:00.000Z")
    assert.equal(steps[3]?.occurredAt, "2026-08-14T13:03:00.000Z")
  })

  it("shows only purchased and the label until the carrier scans the package", () => {
    const labeled = buildPurchaseDetailTimeline({
      createdAt,
      fulfillmentMethod: "shipping",
      deliveryStatus: "shipped",
      orderStatus: "confirmed",
      hasTrackingNumber: true,
      carrierStatusCode: "AC",
      events: [
        { occurred_at: "2026-10-27T17:51:00.000Z", description: "Shipping Label Created" },
      ],
      actualDeliveryAt: null,
      refundedAt: null,
    })
    assert.deepEqual(
      labeled.map((step) => [step.title, step.state]),
      [
        ["Purchased", "done"],
        ["Shipping Label Created", "done"],
      ],
    )
    assert.equal(labeled[1]?.occurredAt, "2026-10-27T17:51:00.000Z")

    const trackingOnly = buildPurchaseDetailTimeline({
      createdAt,
      fulfillmentMethod: "shipping",
      deliveryStatus: "shipped",
      orderStatus: "confirmed",
      hasTrackingNumber: true,
      carrierStatusCode: "NY",
      events: [],
      actualDeliveryAt: null,
      refundedAt: null,
    })
    assert.deepEqual(
      trackingOnly.map((step) => step.title),
      ["Purchased", "Shipping Label Created"],
    )
  })

  it("adds seller marked shipped when the carrier takes possession", () => {
    const steps = buildPurchaseDetailTimeline({
      createdAt,
      fulfillmentMethod: "shipping",
      deliveryStatus: "shipped",
      orderStatus: "confirmed",
      hasTrackingNumber: true,
      events: [
        { occurred_at: "2026-10-28T15:04:00.000Z", description: "USPS in possession of item" },
        { occurred_at: "2026-10-27T17:51:00.000Z", description: "Shipping Label Created" },
      ],
      actualDeliveryAt: null,
      refundedAt: null,
    })
    assert.deepEqual(
      steps.map((step) => step.title),
      [
        "Purchased",
        "Shipping Label Created",
        "Seller marked shipped",
        "USPS in possession of item",
      ],
    )
    assert.equal(steps[2]?.occurredAt, "2026-10-28T15:04:00.000Z")
    assert.equal(steps[1]?.occurredAt, "2026-10-27T17:51:00.000Z")
  })

  it("treats an acceptance status with no events as a carrier scan", () => {
    const steps = buildPurchaseDetailTimeline({
      createdAt,
      fulfillmentMethod: "shipping",
      deliveryStatus: "pending",
      orderStatus: "confirmed",
      hasTrackingNumber: true,
      carrierStatusCode: "AC",
      events: [],
      actualDeliveryAt: null,
      refundedAt: null,
    })
    assert.deepEqual(
      steps.map((step) => [step.title, step.state]),
      [
        ["Purchased", "done"],
        ["Shipping Label Created", "done"],
        ["Seller marked shipped", "done"],
        ["Delivered", "upcoming"],
      ],
    )
  })

  it("keeps electronic label notices from counting as a handoff", () => {
    const steps = buildPurchaseDetailTimeline({
      createdAt,
      fulfillmentMethod: "shipping",
      deliveryStatus: "shipped",
      orderStatus: "confirmed",
      hasTrackingNumber: true,
      events: [
        {
          occurred_at: "2026-10-27T17:51:00.000Z",
          description: "Shipment information sent to USPS",
        },
      ],
      actualDeliveryAt: null,
      refundedAt: null,
    })
    assert.deepEqual(
      steps.map((step) => step.title),
      ["Purchased", "Shipment information sent to USPS"],
    )
  })

  it("adds a delivered step when scans never say delivered", () => {
    const steps = buildPurchaseDetailTimeline({
      createdAt,
      fulfillmentMethod: "shipping",
      deliveryStatus: "delivered",
      orderStatus: "confirmed",
      hasTrackingNumber: true,
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
