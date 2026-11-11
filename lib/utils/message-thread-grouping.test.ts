import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  MESSAGE_GROUP_GAP_MS,
  messageBubbleGroup,
  shouldBreakMessageGroup,
} from "./message-thread-grouping.ts"

describe("shouldBreakMessageGroup", () => {
  it("starts a group when there is no previous message", () => {
    assert.equal(shouldBreakMessageGroup(null, "2026-11-08T12:00:00.000Z"), true)
  })

  it("keeps consecutive messages in the same run", () => {
    assert.equal(
      shouldBreakMessageGroup("2026-11-08T12:00:00.000Z", "2026-11-08T12:10:00.000Z"),
      false,
    )
  })

  it("breaks after the idle gap", () => {
    const later = new Date(Date.parse("2026-11-08T12:00:00.000Z") + MESSAGE_GROUP_GAP_MS + 1)
    assert.equal(shouldBreakMessageGroup("2026-11-08T12:00:00.000Z", later.toISOString()), true)
  })

  it("breaks across calendar days even when close in time", () => {
    assert.equal(
      shouldBreakMessageGroup("2026-11-07T23:50:00.000Z", "2026-11-08T00:05:00.000Z"),
      true,
    )
  })
})

describe("messageBubbleGroup", () => {
  it("maps grouping neighbors to iMessage positions", () => {
    assert.equal(messageBubbleGroup(false, false), "single")
    assert.equal(messageBubbleGroup(false, true), "first")
    assert.equal(messageBubbleGroup(true, true), "middle")
    assert.equal(messageBubbleGroup(true, false), "last")
  })
})
