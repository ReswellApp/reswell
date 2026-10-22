import assert from "node:assert/strict"
import { describe, it } from "node:test"
// @ts-expect-error Node's type-stripping test runner requires the TypeScript extension.
import type { OrderTrackingDetail } from "./order-tracking-detail.ts"
// @ts-expect-error Node's type-stripping test runner requires the TypeScript extension.
import {
  orderDeliveryAlreadyRecorded,
  shouldEmitOrderShippingUpdate,
} from "./order-tracking-update-key.ts"

function detail(overrides: Partial<OrderTrackingDetail> = {}): OrderTrackingDetail {
  return {
    source: "shipengine",
    status_code: "IT",
    status_description: "In transit",
    carrier_status_description: null,
    estimated_delivery_date: null,
    actual_delivery_date: null,
    exception_description: null,
    events: [
      {
        occurred_at: "2026-07-12T18:00:00.000Z",
        description: "In transit",
        city_locality: "Los Angeles",
        state_province: "CA",
        postal_code: null,
        country_code: "US",
      },
    ],
    updated_at: "2026-07-12T18:00:00.000Z",
    ...overrides,
  }
}

const deliveredJuly = detail({
  status_code: "DE",
  status_description: "Delivered",
  carrier_status_description: "Delivered",
  actual_delivery_date: "2026-07-13T17:41:00.000Z",
  events: [
    {
      occurred_at: "2026-07-13T17:41:00.000Z",
      description: "Delivered",
      city_locality: "Santa Barbara",
      state_province: "CA",
      postal_code: "93101",
      country_code: "US",
    },
  ],
  updated_at: "2026-07-13T17:41:00.000Z",
})

const deliveredFrontDoor = detail({
  status_code: "DE",
  status_description: "Delivered",
  carrier_status_description: "Delivered, Front Door/Porch",
  actual_delivery_date: "2026-07-13T17:41:00.000Z",
  events: [
    {
      occurred_at: "2026-07-13T10:41:00-07:00",
      description: "Delivered, Front Door/Porch",
      city_locality: "Santa Barbara",
      state_province: "CA",
      postal_code: "93101",
      country_code: "US",
    },
  ],
  updated_at: "2026-10-22T01:29:00.000Z",
})

describe("shouldEmitOrderShippingUpdate", () => {
  it("does not re-announce a delivery when only the snapshot wording changes", () => {
    assert.equal(
      shouldEmitOrderShippingUpdate({
        previous: deliveredJuly,
        next: deliveredFrontDoor,
      }),
      false,
    )
  })

  it("does not announce delivery when the order was already marked delivered", () => {
    const staleInTransit = detail()
    assert.equal(
      shouldEmitOrderShippingUpdate({
        previous: staleInTransit,
        next: deliveredFrontDoor,
        deliveryAlreadyRecorded: true,
      }),
      false,
    )
  })

  it("announces the first transition into delivered", () => {
    assert.equal(
      shouldEmitOrderShippingUpdate({
        previous: detail(),
        next: deliveredJuly,
        deliveryAlreadyRecorded: false,
      }),
      true,
    )
  })

  it("still announces an in-transit scan change", () => {
    const next = detail({
      events: [
        {
          occurred_at: "2026-07-13T15:00:00.000Z",
          description: "Out for delivery",
          city_locality: "Santa Barbara",
          state_province: "CA",
          postal_code: null,
          country_code: "US",
        },
      ],
      status_code: "OF",
      status_description: "Out for delivery",
    })
    assert.equal(
      shouldEmitOrderShippingUpdate({
        previous: detail(),
        next,
      }),
      true,
    )
  })

  it("does not emit when the scan key is unchanged", () => {
    assert.equal(
      shouldEmitOrderShippingUpdate({
        previous: deliveredJuly,
        next: { ...deliveredJuly, updated_at: "2026-10-22T01:29:00.000Z" },
      }),
      false,
    )
  })
})

describe("orderDeliveryAlreadyRecorded", () => {
  it("treats a stored carrier delivery timestamp as already delivered", () => {
    assert.equal(
      orderDeliveryAlreadyRecorded({
        deliveryStatus: "shipped",
        carrierDeliveredAt: "2026-07-13T17:41:00.000Z",
      }),
      true,
    )
    assert.equal(
      orderDeliveryAlreadyRecorded({
        deliveryStatus: "delivered",
        carrierDeliveredAt: null,
      }),
      true,
    )
    assert.equal(
      orderDeliveryAlreadyRecorded({
        deliveryStatus: "shipped",
        carrierDeliveredAt: null,
      }),
      false,
    )
  })
})
