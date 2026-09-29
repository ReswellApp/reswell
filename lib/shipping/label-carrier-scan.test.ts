import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { OrderTrackingDetail } from "./order-tracking-detail.ts"
import { shipEngineTrackingIndicatesPhysicalScan } from "./label-carrier-scan.ts"

function detail(partial: Partial<OrderTrackingDetail>): OrderTrackingDetail {
  return {
    source: "shipengine",
    status_code: null,
    status_description: null,
    carrier_status_description: null,
    estimated_delivery_date: null,
    actual_delivery_date: null,
    exception_description: null,
    events: [],
    updated_at: "2026-09-29T12:00:00.000Z",
    ...partial,
  }
}

describe("shipEngineTrackingIndicatesPhysicalScan", () => {
  it("treats not-yet-in-system as unused", () => {
    assert.equal(shipEngineTrackingIndicatesPhysicalScan(detail({ status_code: "NY" })), false)
  })

  it("ignores a label-created event", () => {
    assert.equal(
      shipEngineTrackingIndicatesPhysicalScan(
        detail({
          status_code: "UN",
          events: [{ description: "Shipping label created", occurred_at: "2026-09-01T00:00:00.000Z" }],
        }),
      ),
      false,
    )
  })

  it("ignores USPS electronic information received", () => {
    assert.equal(
      shipEngineTrackingIndicatesPhysicalScan(
        detail({
          status_code: "NY",
          events: [{ description: "Shipment information sent to USPS", occurred_at: "2026-09-01T00:00:00.000Z" }],
        }),
      ),
      false,
    )
  })

  it("counts an acceptance scan", () => {
    assert.equal(shipEngineTrackingIndicatesPhysicalScan(detail({ status_code: "AC" })), true)
  })

  it("counts a possession event even when the status code is still unknown", () => {
    assert.equal(
      shipEngineTrackingIndicatesPhysicalScan(
        detail({
          status_code: "UN",
          events: [{ description: "Arrived at facility", occurred_at: "2026-09-10T00:00:00.000Z" }],
        }),
      ),
      true,
    )
  })
})
