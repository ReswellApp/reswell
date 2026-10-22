import assert from "node:assert/strict"
import { describe, it } from "node:test"
// @ts-expect-error Node's type-stripping test runner requires the TypeScript extension.
import type { OrderTrackingDetail } from "./order-tracking-detail.ts"
// @ts-expect-error Node's type-stripping test runner requires the TypeScript extension.
import { planOrderShippingNotification } from "./order-shipping-notify-plan.ts"
// @ts-expect-error Node's type-stripping test runner requires the TypeScript extension.
import type { OrderShippingSmsMilestone } from "./order-shipping-sms-milestone.ts"

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
})

const deliveredFrontDoor = detail({
  ...deliveredJuly,
  carrier_status_description: "Delivered, Front Door/Porch",
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

const none = new Set<OrderShippingSmsMilestone>()
const deliveredClaimed = new Set<OrderShippingSmsMilestone>(["delivered"])

describe("planOrderShippingNotification", () => {
  it("claims delivery once, including when the carrier rewrites the status line", () => {
    assert.deepEqual(
      planOrderShippingNotification({
        previous: detail(),
        next: deliveredJuly,
        claimedMilestones: none,
        notifyScanUpdates: false,
      }),
      { kind: "milestone", milestone: "delivered" },
    )
    assert.deepEqual(
      planOrderShippingNotification({
        previous: deliveredJuly,
        next: deliveredFrontDoor,
        claimedMilestones: deliveredClaimed,
        notifyScanUpdates: true,
      }),
      { kind: "skip" },
    )
  })

  it("does not email a scan because someone opened the purchase", () => {
    const nextHop = detail({
      status_code: "IT",
      status_description: "In transit",
      events: [
        {
          occurred_at: "2026-07-13T15:00:00.000Z",
          description: "Arrived at facility",
          city_locality: "Santa Barbara",
          state_province: "CA",
          postal_code: null,
          country_code: "US",
        },
      ],
    })
    assert.deepEqual(
      planOrderShippingNotification({
        previous: detail(),
        next: nextHop,
        claimedMilestones: none,
        notifyScanUpdates: false,
      }),
      { kind: "skip" },
    )
    assert.deepEqual(
      planOrderShippingNotification({
        previous: detail(),
        next: nextHop,
        claimedMilestones: none,
        notifyScanUpdates: true,
      }),
      { kind: "scan" },
    )
  })

  it("lets the first out-for-delivery observation send, then stops", () => {
    const outForDelivery = detail({
      status_code: "OF",
      status_description: "Out for delivery",
      events: [
        {
          occurred_at: "2026-07-13T16:00:00.000Z",
          description: "Out for delivery",
          city_locality: "Santa Barbara",
          state_province: "CA",
          postal_code: null,
          country_code: "US",
        },
      ],
    })
    assert.deepEqual(
      planOrderShippingNotification({
        previous: detail(),
        next: outForDelivery,
        claimedMilestones: none,
        notifyScanUpdates: false,
      }),
      { kind: "milestone", milestone: "out_for_delivery" },
    )
    assert.deepEqual(
      planOrderShippingNotification({
        previous: detail(),
        next: outForDelivery,
        claimedMilestones: new Set<OrderShippingSmsMilestone>(["out_for_delivery"]),
        notifyScanUpdates: true,
      }),
      { kind: "skip" },
    )
  })

  it("does not reopen a delivered order when a later snapshot says out for delivery", () => {
    const outForDelivery = detail({
      status_code: "OF",
      status_description: "Out for delivery",
    })
    assert.deepEqual(
      planOrderShippingNotification({
        previous: deliveredJuly,
        next: outForDelivery,
        claimedMilestones: deliveredClaimed,
        notifyScanUpdates: true,
      }),
      { kind: "skip" },
    )
  })
})
