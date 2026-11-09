import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveCombinedPackedParcelFromListings } from "./reswell-packed-parcel-from-listing.ts"
import {
  MAX_SURFBOARDS_PER_SELLER_CHECKOUT,
  peerCheckoutSurfboardCountError,
  surfboardsRequireSeparatePackages,
} from "./surfboard-multi-board-parcel.ts"

describe("surfboard one-box cap", () => {
  it("allows a cart and checkout of three surfboards in one box", () => {
    assert.equal(surfboardsRequireSeparatePackages(MAX_SURFBOARDS_PER_SELLER_CHECKOUT), false)
    assert.equal(peerCheckoutSurfboardCountError(3), null)
    assert.equal(peerCheckoutSurfboardCountError(1), null)
  })

  it("requires separate packages once a fourth surfboard is added", () => {
    assert.equal(surfboardsRequireSeparatePackages(4), true)
    const message = peerCheckoutSurfboardCountError(4)
    assert.ok(message)
    assert.match(message, /one box/i)
    assert.doesNotMatch(message, /cannot|can't buy|up to 3 surfboards from the same seller/i)
  })

  it("refuses to build one carton for four surfboards", () => {
    const rows = Array.from({ length: 4 }, () => ({ section: "surfboards", dimensions: `6'6" x 21" x 2 5/8"` }))
    const result = resolveCombinedPackedParcelFromListings(rows)
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.match(result.error, /one box/i)
    }
  })
})
