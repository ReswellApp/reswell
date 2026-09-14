import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  listingLocalityFromAddress,
  listingLocalityHasPin,
} from "./listing-locality-from-address.ts"

describe("listingLocalityFromAddress", () => {
  it("returns city and state only — never street or ZIP", () => {
    const loc = listingLocalityFromAddress({
      city: "Encinitas",
      state: "CA",
    })
    assert.ok(loc)
    assert.equal(loc.city, "Encinitas")
    assert.equal(loc.state, "CA")
    assert.equal(loc.displayName, "Encinitas, CA")
    assert.equal(loc.lat, null)
    assert.equal(loc.lng, null)
    assert.equal("line1" in loc, false)
    assert.doesNotMatch(loc.displayName, /\d/)
  })

  it("ignores a street-looking object and only reads city/state", () => {
    const loc = listingLocalityFromAddress({
      city: "Santa Barbara",
      state: "CA",
      line1: "123 Hidden Cove Rd",
      postal_code: "93101",
    } as { city: string; state: string })
    assert.ok(loc)
    assert.equal(loc.displayName, "Santa Barbara, CA")
    assert.doesNotMatch(JSON.stringify(loc), /Hidden Cove/)
    assert.doesNotMatch(JSON.stringify(loc), /93101/)
  })

  it("returns null without a city", () => {
    assert.equal(listingLocalityFromAddress({ city: "  ", state: "CA" }), null)
  })

  it("keeps a city-centroid pin when provided", () => {
    const loc = listingLocalityFromAddress(
      { city: "San Diego", state: "CA" },
      { lat: 32.7157, lng: -117.1611 },
    )
    assert.ok(loc)
    assert.equal(listingLocalityHasPin(loc), true)
    assert.equal(loc.lat, 32.7157)
  })
})
