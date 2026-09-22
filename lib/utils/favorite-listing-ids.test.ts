import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { listingIdsEligibleForFavoriteLookup } from "./favorite-listing-ids.ts"

describe("listingIdsEligibleForFavoriteLookup", () => {
  it("returns an empty list when there are no listing ids", () => {
    assert.deepEqual(listingIdsEligibleForFavoriteLookup([]), [])
  })

  it("drops non-UUID values and duplicates", () => {
    const id = "11111111-1111-4111-8111-111111111111"
    assert.deepEqual(listingIdsEligibleForFavoriteLookup([id, "not-a-uuid", id, ""]), [id])
  })
})
