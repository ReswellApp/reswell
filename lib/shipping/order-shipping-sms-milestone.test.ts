import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { OrderTrackingDetail } from "./order-tracking-detail.ts"
import {
  buyerShippingUpdateToEmit,
  resolveShippingNotificationKind,
} from "./order-shipping-sms-milestone.ts"

function scan(input: {
  status?: string
  description: string
  at?: string
  exception?: string | null
  deliveredAt?: string | null
}): OrderTrackingDetail {
  const at = input.at ?? "2026-10-21T15:00:00.000Z"
  return {
    source: "shipengine",
    status_code: input.status ?? "IT",
    status_description: input.description,
    carrier_status_description: input.description,
    estimated_delivery_date: null,
    actual_delivery_date: input.deliveredAt ?? null,
    exception_description: input.exception ?? null,
    events: [
      {
        occurred_at: at,
        description: input.description,
        city_locality: "San Diego",
        state_province: "CA",
      },
    ],
    updated_at: at,
  }
}

describe("shipping notification milestones", () => {
  it("ignores facility hops that were filling the inbox", () => {
    const hops = [
      "Arrived at Post Office",
      "Arrived at USPS Facility",
      "Departed USPS Facility",
      "In Transit to Next Facility",
      "Accepted at USPS Origin Facility",
      "Picked up",
      "Expected Delivery Between 9:30am and 1:30pm",
    ]
    for (const description of hops) {
      assert.equal(resolveShippingNotificationKind(scan({ description })), null, description)
    }
  })

  it("treats a local hold as pickup, not a post-office transit scan", () => {
    assert.equal(
      resolveShippingNotificationKind(
        scan({ description: "Held at Post Office, At Customer Request" }),
      ),
      "available_for_pickup",
    )
    assert.equal(
      resolveShippingNotificationKind(
        scan({ description: "Notice Left (No Authorized Recipient Available)" }),
      ),
      "available_for_pickup",
    )
  })

  it("does not notify when the carrier only moves between facilities", () => {
    const arrived = scan({
      description: "Arrived at USPS Facility",
      at: "2026-10-21T12:00:00.000Z",
    })
    const departed = scan({
      description: "Departed USPS Facility",
      at: "2026-10-21T14:00:00.000Z",
    })
    const postOffice = scan({
      description: "Arrived at Post Office",
      at: "2026-10-21T18:00:00.000Z",
    })

    assert.equal(buyerShippingUpdateToEmit(arrived, departed), null)
    assert.equal(buyerShippingUpdateToEmit(departed, postOffice), null)
  })

  it("notifies once for out-for-delivery, including a same-day window change", () => {
    const departed = scan({
      description: "Departed USPS Facility",
      at: "2026-10-21T12:00:00.000Z",
    })
    const outForDelivery = scan({
      description: "Out for Delivery, Expected Delivery Between 9:30am and 1:30pm",
      at: "2026-10-21T16:00:00.000Z",
    })
    const laterWindow = scan({
      description: "Out for Delivery, Expected Delivery Between 1:30pm and 5:30pm",
      at: "2026-10-21T18:30:00.000Z",
    })

    const first = buyerShippingUpdateToEmit(departed, outForDelivery)
    assert.equal(first?.kind, "out_for_delivery")
    assert.equal(first?.smsMilestone, "out_for_delivery")
    assert.equal(first?.dedupeKey, "out_for_delivery-2026-10-21")

    assert.equal(buyerShippingUpdateToEmit(outForDelivery, laterWindow), null)
  })

  it("notifies again when the carrier takes the package out the next day", () => {
    const yesterday = scan({
      description: "Out for Delivery",
      status: "OF",
      at: "2026-10-21T16:00:00.000Z",
    })
    const today = scan({
      description: "On Vehicle for Delivery",
      at: "2026-10-22T15:00:00.000Z",
    })

    const update = buyerShippingUpdateToEmit(yesterday, today)
    assert.equal(update?.kind, "out_for_delivery")
    assert.equal(update?.dedupeKey, "out_for_delivery-2026-10-22")
  })

  it("notifies for a failed attempt and maps it to the exception SMS filter", () => {
    const inTransit = scan({ description: "Arrived at USPS Facility", at: "2026-10-21T13:00:00.000Z" })
    const attempt = scan({
      status: "AT",
      description: "Delivery Attempted - No Access to Delivery Location",
      at: "2026-10-21T17:00:00.000Z",
    })

    const update = buyerShippingUpdateToEmit(inTransit, attempt)
    assert.equal(update?.kind, "delivery_attempt")
    assert.equal(update?.smsMilestone, "exception")
  })

  it("notifies when an exception reason changes, and not when the same reason repeats", () => {
    const inTransit = scan({ description: "In Transit", at: "2026-10-21T12:00:00.000Z" })
    const weather = scan({
      status: "EX",
      description: "Weather Delay",
      at: "2026-10-21T18:00:00.000Z",
    })
    const weatherAgain = scan({
      status: "EX",
      description: "Shipment delayed",
      at: "2026-10-22T12:00:00.000Z",
    })
    const returned = scan({
      status: "EX",
      description: "Return to Sender",
      at: "2026-10-23T12:00:00.000Z",
    })
    const returnedAgain = scan({
      status: "EX",
      description: "Return to Sender Processed",
      at: "2026-10-24T12:00:00.000Z",
    })

    const first = buyerShippingUpdateToEmit(inTransit, weather)
    assert.equal(first?.kind, "exception")
    assert.equal(first?.dedupeKey, "exception-exception")
    assert.equal(buyerShippingUpdateToEmit(weather, weatherAgain), null)

    const second = buyerShippingUpdateToEmit(weatherAgain, returned)
    assert.equal(second?.dedupeKey, "exception-return-to-sender")
    assert.equal(buyerShippingUpdateToEmit(returned, returnedAgain), null)
  })

  it("sends delivered once", () => {
    const outForDelivery = scan({
      status: "OF",
      description: "Out for Delivery",
      at: "2026-10-21T16:00:00.000Z",
    })
    const delivered = scan({
      status: "DE",
      description: "Delivered, In/At Mailbox",
      at: "2026-10-21T20:00:00.000Z",
      deliveredAt: "2026-10-21T20:00:00.000Z",
    })
    const deliveredAgain = scan({
      status: "DE",
      description: "Delivered, Front Door",
      at: "2026-10-21T20:05:00.000Z",
      deliveredAt: "2026-10-21T20:05:00.000Z",
    })

    const update = buyerShippingUpdateToEmit(outForDelivery, delivered)
    assert.equal(update?.kind, "delivered")
    assert.equal(update?.smsMilestone, "delivered")
    assert.equal(update?.dedupeKey, "delivered")
    assert.equal(buyerShippingUpdateToEmit(delivered, deliveredAgain), null)
  })

  it("does not notify on the first snapshot", () => {
    assert.equal(
      buyerShippingUpdateToEmit(
        null,
        scan({ description: "Out for Delivery", status: "OF" }),
      ),
      null,
    )
    assert.equal(
      buyerShippingUpdateToEmit(
        null,
        scan({ status: "DE", description: "Delivered", deliveredAt: "2026-10-21T20:00:00.000Z" }),
      ),
      null,
    )
  })
})
