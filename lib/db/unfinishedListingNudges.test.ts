import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { UNFINISHED_LISTING_ELIGIBLE_SELECT } from "./unfinishedListingNudges.ts"

describe("UNFINISHED_LISTING_ELIGIBLE_SELECT", () => {
  it("does not request numeric dim columns dropped in 20260816", () => {
    for (const dropped of [
      "length_feet",
      "length_inches",
      "width",
      "thickness",
      "volume",
    ]) {
      assert.equal(
        new RegExp(`\\b${dropped}\\b`).test(UNFINISHED_LISTING_ELIGIBLE_SELECT),
        false,
        `select still requests ${dropped}`,
      )
    }
  })

  it("requests the current listings dimension columns", () => {
    assert.match(UNFINISHED_LISTING_ELIGIBLE_SELECT, /\bdimensions\b/)
    assert.match(UNFINISHED_LISTING_ELIGIBLE_SELECT, /\blength_total_inches\b/)
    assert.match(UNFINISHED_LISTING_ELIGIBLE_SELECT, /\bvolume_liters\b/)
  })
})
