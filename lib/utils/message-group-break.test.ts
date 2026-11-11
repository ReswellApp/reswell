import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isSameUtcCalendarDay, shouldBreakMessageGroup } from "./message-group-break.ts"

describe("isSameUtcCalendarDay", () => {
  it("treats 23:30 UTC and 00:30 UTC next day as different days", () => {
    const late = new Date("2026-11-07T23:30:00.000Z")
    const early = new Date("2026-11-08T00:30:00.000Z")
    assert.equal(isSameUtcCalendarDay(late, early), false)
  })

  it("stays stable across Pacific local-midnight for the same UTC day", () => {
    // 2026-11-08 07:00 UTC = Nov 7 11pm Pacific. Local calendar would split;
    // UTC grouping must not, or SSR HTML disagrees with the browser.
    const beforePacificMidnight = new Date("2026-11-08T06:00:00.000Z")
    const afterPacificMidnight = new Date("2026-11-08T09:00:00.000Z")
    assert.equal(isSameUtcCalendarDay(beforePacificMidnight, afterPacificMidnight), true)
  })
})

describe("shouldBreakMessageGroup", () => {
  it("breaks the first message in a thread", () => {
    assert.equal(shouldBreakMessageGroup(null, "2026-11-08T18:00:00.000Z"), true)
  })

  it("does not break messages 10 minutes apart on the same UTC day", () => {
    assert.equal(
      shouldBreakMessageGroup("2026-11-08T18:00:00.000Z", "2026-11-08T18:10:00.000Z"),
      false,
    )
  })

  it("breaks after a 45+ minute gap", () => {
    assert.equal(
      shouldBreakMessageGroup("2026-11-08T18:00:00.000Z", "2026-11-08T18:46:00.000Z"),
      true,
    )
  })

  it("breaks across UTC midnight even when the gap is small", () => {
    assert.equal(
      shouldBreakMessageGroup("2026-11-07T23:50:00.000Z", "2026-11-08T00:05:00.000Z"),
      true,
    )
  })
})
