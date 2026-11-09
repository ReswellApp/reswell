import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { formatDeskTime, formatLocalThreadTime } from "./format-local-thread-time.ts"

describe("formatLocalThreadTime", () => {
  it("returns empty for invalid input", () => {
    assert.equal(formatLocalThreadTime("not-a-date"), "")
  })

  it("labels a timestamp from this minute as a clock time", () => {
    const label = formatLocalThreadTime(new Date().toISOString())
    assert.match(label, /^\d{1,2}:\d{2} (AM|PM)$/)
  })
})

describe("formatDeskTime", () => {
  it("returns empty for invalid input", () => {
    assert.equal(formatDeskTime("nope"), "")
  })

  it("compacts minutes", () => {
    const threeMinAgo = new Date(Date.now() - 3 * 60_000 - 5_000).toISOString()
    assert.match(formatDeskTime(threeMinAgo), /\d+ min/)
  })
})
