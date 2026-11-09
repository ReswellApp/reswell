import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { partitionListingsByOpenMarketplaceCheckout } from "./listingDeleteEligibility.ts"

describe("partitionListingsByOpenMarketplaceCheckout", () => {
  it("keeps listings with an open sibling checkout out of the relist set", () => {
    const listingId = "bce4fc90-40d0-4769-bd3a-005310b5b6f6"
    const other = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    const result = partitionListingsByOpenMarketplaceCheckout(
      [listingId, other],
      new Set([listingId]),
    )
    assert.deepEqual(result.blocked, [listingId])
    assert.deepEqual(result.allowed, [other])
  })

  it("allows relist when no open checkout remains", () => {
    const listingId = "bce4fc90-40d0-4769-bd3a-005310b5b6f6"
    const result = partitionListingsByOpenMarketplaceCheckout([listingId], new Set())
    assert.deepEqual(result.allowed, [listingId])
    assert.deepEqual(result.blocked, [])
  })
})
