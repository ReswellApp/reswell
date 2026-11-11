import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  formatInboxTimestamp,
  formatMessageClock,
  formatThreadGroupTimestamp,
} from "./message-display-time.ts"

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

function atHours(base: Date, hours: number, minutes: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0)
}

function daysAgo(base: Date, days: number, hours = 10, minutes = 0): Date {
  const next = atHours(base, hours, minutes)
  next.setDate(base.getDate() - days)
  return next
}

describe("formatInboxTimestamp", () => {
  it("shows the clock time for messages from today", () => {
    const now = new Date()
    const date = atHours(now, 9, 41)
    assert.equal(formatInboxTimestamp(date.toISOString(), now), "9:41 AM")
  })

  it("labels yesterday without a time", () => {
    const now = new Date()
    assert.equal(formatInboxTimestamp(daysAgo(now, 1).toISOString(), now), "Yesterday")
  })

  it("uses the weekday for earlier this week", () => {
    const now = new Date()
    const date = daysAgo(now, 3)
    assert.equal(formatInboxTimestamp(date.toISOString(), now), WEEKDAYS[date.getDay()])
  })

  it("uses month and day later in the same year", () => {
    const now = new Date(2026, 10, 8, 12, 0, 0)
    const date = new Date(2026, 2, 14, 10, 0, 0)
    assert.equal(formatInboxTimestamp(date.toISOString(), now), "Mar 14")
  })

  it("includes the year for older messages", () => {
    const now = new Date(2026, 10, 8, 12, 0, 0)
    const date = new Date(2025, 11, 1, 10, 0, 0)
    assert.equal(formatInboxTimestamp(date.toISOString(), now), "12/1/25")
  })
})

describe("formatThreadGroupTimestamp", () => {
  it("shows only the time for today", () => {
    const now = new Date()
    const date = atHours(now, 9, 41)
    assert.equal(formatThreadGroupTimestamp(date.toISOString(), now), formatMessageClock(date))
  })

  it("prefixes yesterday", () => {
    const now = new Date()
    const date = daysAgo(now, 1, 16, 20)
    assert.equal(
      formatThreadGroupTimestamp(date.toISOString(), now),
      `Yesterday ${formatMessageClock(date)}`,
    )
  })
})
