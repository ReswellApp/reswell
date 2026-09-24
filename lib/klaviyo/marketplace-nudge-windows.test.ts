import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  hoursUntil,
  offerIsInExpiringWindow,
  orderIsInFulfillmentReminderWindow,
} from "./marketplace-nudge-windows.ts"

const NOW = new Date("2026-09-24T15:00:00.000Z")

describe("offerIsInExpiringWindow", () => {
  it("is true inside the last 12 hours", () => {
    assert.equal(offerIsInExpiringWindow("2026-09-25T02:00:00.000Z", NOW), true)
    assert.equal(offerIsInExpiringWindow("2026-09-24T15:30:00.000Z", NOW), true)
  })

  it("is false when the offer already expired or has more than 12 hours left", () => {
    assert.equal(offerIsInExpiringWindow("2026-09-24T14:00:00.000Z", NOW), false)
    assert.equal(offerIsInExpiringWindow("2026-09-25T04:00:00.000Z", NOW), false)
    assert.equal(offerIsInExpiringWindow("not-a-date", NOW), false)
  })
})

describe("orderIsInFulfillmentReminderWindow", () => {
  it("is true from 48 hours through 8 days", () => {
    assert.equal(orderIsInFulfillmentReminderWindow("2026-09-22T15:00:00.000Z", NOW), true)
    assert.equal(orderIsInFulfillmentReminderWindow("2026-09-18T15:00:00.000Z", NOW), true)
  })

  it("is false when the order is new or older than 8 days", () => {
    assert.equal(orderIsInFulfillmentReminderWindow("2026-09-23T15:00:00.000Z", NOW), false)
    assert.equal(orderIsInFulfillmentReminderWindow("2026-09-16T14:00:00.000Z", NOW), false)
  })
})

describe("hoursUntil", () => {
  it("rounds up and never returns zero while time remains", () => {
    assert.equal(hoursUntil("2026-09-24T16:10:00.000Z", NOW), 2)
    assert.equal(hoursUntil("2026-09-24T15:00:00.000Z", NOW), 1)
  })
})
