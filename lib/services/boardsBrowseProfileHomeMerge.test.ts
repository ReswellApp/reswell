import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  boardsBrowseProfileHomeRedirectHref,
  mergeProfileBrowseHomeIntoBrowseParams,
} from "./boardsBrowseProfileHomeMerge.ts"

const HOME = {
  applyOnBoards: true,
  localPickupOnly: false,
  location: "San Diego, CA",
  lat: 32.7,
  lng: -117.1,
  radiusMi: "50" as const,
}

describe("boardsBrowseProfileHomeMerge", () => {
  it("fills geo as a home preference when apply on boards is enabled", () => {
    const merged = mergeProfileBrowseHomeIntoBrowseParams({}, HOME)

    assert.equal(merged.searchParams.pickup, undefined)
    assert.equal(merged.searchParams.location, "San Diego, CA")
    assert.equal(merged.searchParams.lat, "32.7")
    assert.equal(merged.searchParams.lng, "-117.1")
    assert.equal(merged.searchParams.radius, "50")
    assert.equal(merged.searchParams.home, "1")
    assert.equal(merged.homeFromProfile, true)
    assert.equal(merged.geoFromProfile, true)
  })

  it("does not re-apply geo after the user dismisses home", () => {
    const merged = mergeProfileBrowseHomeIntoBrowseParams({ home: "off" }, HOME)

    assert.equal(merged.searchParams.location, undefined)
    assert.equal(merged.searchParams.lat, undefined)
    assert.equal(merged.searchParams.radius, undefined)
    assert.equal(merged.searchParams.home, "off")
    assert.equal(merged.homeFromProfile, false)
    assert.equal(merged.geoFromProfile, false)
  })

  it("does not refill radius when the URL already has coordinates", () => {
    const merged = mergeProfileBrowseHomeIntoBrowseParams(
      { lat: "33.1", lng: "-117.2" },
      HOME,
    )

    assert.equal(merged.searchParams.lat, "33.1")
    assert.equal(merged.searchParams.lng, "-117.2")
    assert.equal(merged.searchParams.radius, undefined)
    assert.equal(merged.searchParams.home, undefined)
    assert.equal(merged.geoFromProfile, false)
  })

  it("adds pickup only when local pickup only is enabled", () => {
    const merged = mergeProfileBrowseHomeIntoBrowseParams({}, {
      ...HOME,
      localPickupOnly: true,
    })

    assert.equal(merged.searchParams.pickup, "1")
    assert.equal(merged.searchParams.home, "1")
  })

  it("does not add pickup when home is dismissed", () => {
    const merged = mergeProfileBrowseHomeIntoBrowseParams(
      { home: "off" },
      { ...HOME, localPickupOnly: true },
    )

    assert.equal(merged.searchParams.pickup, undefined)
  })

  it("keeps URL geo when already present", () => {
    const merged = mergeProfileBrowseHomeIntoBrowseParams(
      { lat: "33.1", lng: "-117.2", radius: "25" },
      HOME,
    )

    assert.equal(merged.searchParams.lat, "33.1")
    assert.equal(merged.searchParams.lng, "-117.2")
    assert.equal(merged.searchParams.radius, "25")
    assert.equal(merged.geoFromProfile, false)
  })

  it("upgrades a legacy injected home URL to a ranking preference", () => {
    const merged = mergeProfileBrowseHomeIntoBrowseParams(
      {
        location: "San Diego, CA",
        lat: "32.7",
        lng: "-117.1",
        radius: "50",
      },
      HOME,
    )

    assert.equal(merged.searchParams.home, "1")
    assert.equal(merged.searchParams.radius, "50")
    assert.equal(merged.geoFromProfile, false)
  })

  it("does not upgrade when the user chose a different radius at the same point", () => {
    const merged = mergeProfileBrowseHomeIntoBrowseParams(
      {
        location: "San Diego, CA",
        lat: "32.7",
        lng: "-117.1",
        radius: "25",
      },
      HOME,
    )

    assert.equal(merged.searchParams.home, undefined)
    assert.equal(merged.searchParams.radius, "25")
  })

  it("redirects when home preference params were filled", () => {
    const merged = mergeProfileBrowseHomeIntoBrowseParams({}, HOME)
    const href = boardsBrowseProfileHomeRedirectHref("/boards", {}, merged)
    assert.ok(href)
    assert.match(href!, /home=1/)
    assert.match(href!, /location=San\+Diego/)
  })

  it("does not redirect after home is dismissed", () => {
    const raw = { home: "off" }
    const merged = mergeProfileBrowseHomeIntoBrowseParams(raw, HOME)
    assert.equal(boardsBrowseProfileHomeRedirectHref("/boards", raw, merged), null)
  })
})
