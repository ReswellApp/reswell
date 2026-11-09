import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { orderListingImageWritesForPrimaryTrigger } from "./listing-image-write-order.ts"

describe("orderListingImageWritesForPrimaryTrigger", () => {
  it("writes the new primary last so the cover trigger sees the final gallery", () => {
    const ordered = orderListingImageWritesForPrimaryTrigger([
      { id: "new-cover", isPrimary: true, sortOrder: 0 },
      { id: "was-cover", isPrimary: false, sortOrder: 1 },
      { id: "rest", isPrimary: false, sortOrder: 2 },
    ])

    assert.deepEqual(
      ordered.map((row) => row.id),
      ["was-cover", "rest", "new-cover"],
    )
  })
})