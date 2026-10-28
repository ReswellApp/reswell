import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mergeProfileBrowseHomeIntoBrowseParams } from "./boardsBrowseProfileHomeMerge.ts"

describe("boardsBrowseProfileHomeMerge", () => {
  it("fills geo when apply on boards is enabled", () => {
    const merged = mergeProfileBrowseHomeIntoBrowseParams({}, {
      applyOnBoards: true,
      localPickupOnly: false,
      location: "San Diego, CA",
      lat: 32.7,
      lng: -117.1,
      radiusMi: "50",
    })

    assert.equal(merged.searchParams.pickup, undefined)
    assert.equal(merged.searchParams.location, "San Diego, CA")
    assert.equal(merged.searchParams.lat, "32.7")
    assert.equal(merged.searchParams.lng, "-117.1")
    assert.equal(merged.searchParams.radius, "50")
    assert.equal(merged.homeFromProfile, true)
    assert.equal(merged.geoFromProfile, true)
  })

  it("adds pickup only when local pickup only is enabled", () => {
    const merged = mergeProfileBrowseHomeIntoBrowseParams({}, {
      applyOnBoards: true,
      localPickupOnly: true,
      location: "San Diego, CA",
      lat: 32.7,
      lng: -117.1,
      radiusMi: "50",
    })

    assert.equal(merged.searchParams.pickup, "1")
  })

  it("keeps URL geo when already present", () => {
    const merged = mergeProfileBrowseHomeIntoBrowseParams(
      { lat: "33.1", lng: "-117.2", radius: "25" },
      {
        applyOnBoards: true,
        localPickupOnly: false,
        location: "San Diego, CA",
        lat: 32.7,
        lng: -117.1,
        radiusMi: "50",
      },
    )

    assert.equal(merged.searchParams.lat, "33.1")
    assert.equal(merged.searchParams.lng, "-117.2")
    assert.equal(merged.searchParams.radius, "25")
    assert.equal(merged.geoFromProfile, false)
  })
})
