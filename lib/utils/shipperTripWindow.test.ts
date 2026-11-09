import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  clampShipperTripWindow,
  deliveryDatesForPickup,
  shipperTripDescriptionError,
  shipperTripWindowError,
  tripCoversWeekday,
  tripDayRole,
  tripWindowSummary,
  weekdaySpanLabel,
} from "./shipperTripWindow.ts"

const thursdayThroughSaturday = {
  pickupStart: 4,
  pickupEnd: 6,
  deliveryStart: 4,
  deliveryEnd: 6,
}

describe("shipper trip windows", () => {
  it("allows one day and a Thursday through Saturday span", () => {
    assert.equal(
      shipperTripWindowError({ pickupStart: 4, pickupEnd: 4, deliveryStart: 4, deliveryEnd: 4 }),
      null,
    )
    assert.equal(shipperTripWindowError(thursdayThroughSaturday), null)
    assert.equal(weekdaySpanLabel(4, 6), "Thursday–Saturday")
    assert.equal(weekdaySpanLabel(4, 4), "Thursday")
  })

  it("rejects a delivery that starts before pickup", () => {
    assert.equal(
      shipperTripWindowError({ pickupStart: 4, pickupEnd: 6, deliveryStart: 3, deliveryEnd: 6 }),
      "Delivery starts on or after the pickup start.",
    )
    assert.equal(
      shipperTripWindowError({ pickupStart: 4, pickupEnd: 3, deliveryStart: 4, deliveryEnd: 4 }),
      "Pickup ends on or after it starts.",
    )
    assert.equal(
      shipperTripWindowError({ pickupStart: 4, pickupEnd: 4, deliveryStart: 5, deliveryEnd: 4 }),
      "Delivery ends on or after it starts.",
    )
  })

  it("keeps the window ordered when the pickup start moves later", () => {
    assert.deepEqual(
      clampShipperTripWindow({ pickupStart: 5, pickupEnd: 4, deliveryStart: 4, deliveryEnd: 4 }),
      { pickupStart: 5, pickupEnd: 5, deliveryStart: 5, deliveryEnd: 5 },
    )
  })

  it("shows the trip on every day the windows cover, including a later delivery day", () => {
    const run = { dayOfWeek: 4, pickupStartDow: 4, pickupEndDow: 4, deliveryStartDow: 6, deliveryEndDow: 6 }
    assert.equal(tripCoversWeekday(run, 3), false)
    assert.equal(tripDayRole(run, 4), "pickup")
    assert.equal(tripCoversWeekday(run, 5), false)
    assert.equal(tripDayRole(run, 6), "delivery")
    assert.equal(tripWindowSummary(run), "Pickup Thursday · Delivery Saturday")
    assert.equal(tripWindowSummary({ dayOfWeek: 2 }), "Tuesday")
  })

  it("turns the matched pickup date into the delivery dates", () => {
    const dates = deliveryDatesForPickup("2026-10-22", {
      dayOfWeek: 4,
      pickupStartDow: 4,
      pickupEndDow: 6,
      deliveryStartDow: 4,
      deliveryEndDow: 6,
    })
    assert.equal(dates.label, "Thursday–Saturday")
    assert.equal(dates.startDate, "2026-10-22")
    assert.equal(dates.endDate, "2026-10-24")
  })

  it("requires both short descriptions", () => {
    assert.equal(shipperTripDescriptionError("Shop door", "After 4"), null)
    assert.equal(shipperTripDescriptionError(" ", "After 4"), "Write a short pickup description.")
    assert.equal(shipperTripDescriptionError("Shop door", "A"), "Write a short delivery description.")
  })
})
