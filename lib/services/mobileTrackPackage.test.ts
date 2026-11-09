import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mobileTrackPackageSchema } from "@reswell/api-contract"
import { toMobileTrackPackage } from "./mobileTrackPackageMap.ts"

const ORDER_ID = "44444444-4444-4444-8444-444444444444"

const PAGE = {
  orderId: ORDER_ID,
  orderNumber: "GRV86Q",
  listingTitle: "CI Happy Everyday",
  trackingNumber: "9334610579400003890845",
  trackingCarrier: "usps · usps_priority_mail",
  deliveryStatus: "delivered",
  detail: {
    source: "shipengine",
    status_code: "DE",
    status_description: "Delivered",
    carrier_status_description:
      "Your item was delivered in or at the mailbox at 12:18 pm on October 29, 2026 in PLYMOUTH, MA 02360.",
    actual_delivery_date: "2026-10-29T16:18:00.000Z",
    events: [
      {
        occurred_at: "2026-10-29T16:18:00.000Z",
        description: "Delivered, In/At Mailbox",
        city_locality: "PLYMOUTH",
        state_province: "MA",
        postal_code: "02360",
        latitude: 41.9584,
        longitude: -70.6673,
      },
      {
        occurred_at: "2026-10-29T12:04:00.000Z",
        description: "Out for Delivery",
        city_locality: "PLYMOUTH",
        state_province: "MA",
        latitude: 41.9584,
        longitude: -70.6673,
      },
      {
        occurred_at: "2026-10-26T17:15:00.000Z",
        description: "Shipping Label Created",
        city_locality: "SANTA BARBARA",
        state_province: "CA",
        latitude: 34.4208,
        longitude: -119.6982,
      },
    ],
    updated_at: "2026-10-29T16:20:00.000Z",
  },
} as const

describe("toMobileTrackPackage", () => {
  it("maps the public tracker page into presentation-ready mobile fields", () => {
    const data = mobileTrackPackageSchema.parse(toMobileTrackPackage(PAGE))
    assert.equal(data.order_id, ORDER_ID)
    assert.equal(data.order_number, "GRV86Q")
    assert.equal(data.listing_title, "CI Happy Everyday")
    assert.equal(data.tracking_number, "9334610579400003890845")
    assert.equal(data.carrier_label, "USPS")
    assert.equal(data.status_label, "Delivered")
    assert.equal(data.status_tone, "success")
    assert.match(data.status_description ?? "", /mailbox/)
    assert.equal(data.delivered_at, "2026-10-29T16:18:00.000Z")
    assert.equal(data.live, false)
    assert.equal(data.events.length, 3)
    assert.equal(data.events[0]?.location, "PLYMOUTH, MA 02360")
    assert.equal(data.events[1]?.location, "PLYMOUTH, MA")
    assert.equal(data.map?.summary, "SANTA BARBARA, CA → PLYMOUTH, MA")
    assert.ok(data.map?.open_url)
  })

  it("keeps in-transit orders live when carrier scans have not posted yet", () => {
    const data = toMobileTrackPackage({
      ...PAGE,
      deliveryStatus: "shipped",
      detail: null,
    })
    assert.equal(data.status_label, "Waiting for carrier scans")
    assert.equal(data.status_tone, "neutral")
    assert.equal(data.status_description, null)
    assert.equal(data.live, true)
    assert.equal(data.map, null)
    assert.deepEqual(data.events, [])
  })
})
