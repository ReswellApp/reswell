import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mergeLocalPickupNearMeIntoBrowseParams } from "./boardsBrowseLocalPickupNearMeMerge.ts"

describe("boardsBrowseLocalPickupNearMeMerge", () => {
  it("fills geo and pickup when preference is enabled", () => {
    const merged = mergeLocalPickupNearMeIntoBrowseParams({}, {
      enabled: true,
      location: "San Diego, CA",
      lat: 32.7,
      lng: -117.1,
      radiusMi: "50",
    })

    assert.equal(merged.searchParams.pickup, "1")
    assert.equal(merged.searchParams.location, "San Diego, CA")
    assert.equal(merged.searchParams.lat, "32.7")
    assert.equal(merged.searchParams.lng, "-117.1")
    assert.equal(merged.searchParams.radius, "50")
    assert.equal(merged.localPickupFromPreference, true)
    assert.equal(merged.geoFromPreference, true)
  })

  it("keeps URL geo when already present", () => {
    const merged = mergeLocalPickupNearMeIntoBrowseParams(
      { lat: "33.1", lng: "-117.2", radius: "25" },
      {
        enabled: true,
        location: "San Diego, CA",
        lat: 32.7,
        lng: -117.1,
        radiusMi: "50",
      },
    )

    assert.equal(merged.searchParams.lat, "33.1")
    assert.equal(merged.searchParams.lng, "-117.2")
    assert.equal(merged.searchParams.radius, "25")
    assert.equal(merged.geoFromPreference, false)
    assert.equal(merged.searchParams.pickup, "1")
  })
})
