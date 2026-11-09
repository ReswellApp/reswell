import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BOARDS_BROWSE_HOME_OFF,
  BOARDS_BROWSE_HOME_ON,
  BOARDS_BROWSE_NEARBY_PRIORITY_DEFAULT_MI,
  applyBoardsBrowseLocationRadiusParams,
  boardsBrowseEsNearbyPrioritySortClause,
  boardsBrowseHomeCoordsMatch,
  boardsBrowseNearbyPriorityMiles,
  boardsBrowseUsesHardRadius,
  clearBoardsBrowseGeoParams,
  isBoardsBrowseHomeDismissed,
  isBoardsBrowseHomePreference,
  markBoardsBrowseHomeDismissed,
  nearbyPriorityBucket,
} from "./boards-browse-home.ts"

describe("boards browse home preference", () => {
  it("treats home=off as a session dismissal", () => {
    assert.equal(isBoardsBrowseHomeDismissed("off"), true)
    assert.equal(isBoardsBrowseHomeDismissed("OFF"), true)
    assert.equal(isBoardsBrowseHomeDismissed("1"), false)
    assert.equal(isBoardsBrowseHomeDismissed(undefined), false)
  })

  it("treats home=1 as a ranking preference", () => {
    assert.equal(isBoardsBrowseHomePreference("1"), true)
    assert.equal(isBoardsBrowseHomePreference("true"), true)
    assert.equal(isBoardsBrowseHomePreference("off"), false)
    assert.equal(isBoardsBrowseHomePreference(undefined), false)
  })

  it("does not hard-filter radius while home preference is on", () => {
    assert.equal(boardsBrowseUsesHardRadius({ home: "1", radius: "100" }), false)
    assert.equal(boardsBrowseUsesHardRadius({ home: "off", radius: "100" }), true)
    assert.equal(boardsBrowseUsesHardRadius({ radius: "50" }), true)
    assert.equal(boardsBrowseUsesHardRadius({ radius: "any" }), false)
    assert.equal(boardsBrowseUsesHardRadius({}), false)
  })

  it("uses saved radius as the nearby bucket for a home preference", () => {
    assert.equal(
      boardsBrowseNearbyPriorityMiles({
        home: "1",
        radius: "50",
        hasLatLng: true,
        sort: "top-picks",
      }),
      50,
    )
  })

  it("boosts nearby without a hard cutoff when location has no radius", () => {
    assert.equal(
      boardsBrowseNearbyPriorityMiles({
        hasLatLng: true,
        sort: "newest",
      }),
      BOARDS_BROWSE_NEARBY_PRIORITY_DEFAULT_MI,
    )
  })

  it("skips nearby-priority ranking for nearest, price sorts, and hard radius", () => {
    assert.equal(
      boardsBrowseNearbyPriorityMiles({
        hasLatLng: true,
        sort: "nearest",
        radius: "25",
      }),
      null,
    )
    assert.equal(
      boardsBrowseNearbyPriorityMiles({
        hasLatLng: true,
        sort: "price-low",
        home: "1",
        radius: "100",
      }),
      null,
    )
    assert.equal(
      boardsBrowseNearbyPriorityMiles({
        hasLatLng: true,
        sort: "newest",
        radius: "25",
      }),
      null,
    )
    assert.equal(
      boardsBrowseNearbyPriorityMiles({
        hasLatLng: false,
        sort: "top-picks",
      }),
      null,
    )
  })

  it("matches profile coords across formatting", () => {
    assert.equal(
      boardsBrowseHomeCoordsMatch("32.71574", "-117.16109", { lat: 32.715736, lng: -117.161087 }),
      true,
    )
    assert.equal(
      boardsBrowseHomeCoordsMatch("34.42", "-119.70", { lat: 32.7, lng: -117.1 }),
      false,
    )
  })

  it("buckets nearer listings first", () => {
    assert.equal(nearbyPriorityBucket(12, 100), 0)
    assert.equal(nearbyPriorityBucket(100, 100), 0)
    assert.equal(nearbyPriorityBucket(101, 100), 1)
    assert.equal(nearbyPriorityBucket(Infinity, 100), 1)
  })

  it("writes a dismiss flag and clears geo params", () => {
    const params = new URLSearchParams("location=SB&lat=34&lng=-119&radius=100")
    clearBoardsBrowseGeoParams(params)
    markBoardsBrowseHomeDismissed(params)
    assert.equal(params.get("location"), null)
    assert.equal(params.get("lat"), null)
    assert.equal(params.get("radius"), null)
    assert.equal(params.get("home"), BOARDS_BROWSE_HOME_OFF)
  })

  it("builds an ES nearby-priority script sort", () => {
    const clause = boardsBrowseEsNearbyPrioritySortClause(34.42, -119.7, 100) as {
      _script: { script: { params: { lat: number; lon: number; radiusMeters: number } } }
    }
    assert.equal(clause._script.script.params.lat, 34.42)
    assert.equal(clause._script.script.params.lon, -119.7)
    assert.equal(Math.round(clause._script.script.params.radiusMeters), 160934)
  })

  it("keeps home=on as the preference token", () => {
    assert.equal(BOARDS_BROWSE_HOME_ON, "1")
  })
})

describe("applyBoardsBrowseLocationRadiusParams", () => {
  it("writes location, coords, and radius in one mutation", () => {
    const params = new URLSearchParams()
    applyBoardsBrowseLocationRadiusParams(params, {
      location: "Santa Barbara, CA, USA",
      lat: 34.42083,
      lng: -119.69819,
      radius: "25",
    })
    assert.equal(params.get("location"), "Santa Barbara, CA, USA")
    assert.equal(params.get("lat"), "34.42083")
    assert.equal(params.get("lng"), "-119.69819")
    assert.equal(params.get("radius"), "25")
    assert.equal(params.get("home"), BOARDS_BROWSE_HOME_OFF)
  })

  it("keeps an existing location when only radius changes", () => {
    const params = new URLSearchParams(
      "location=Santa+Barbara%2C+CA&lat=34.42&lng=-119.7",
    )
    applyBoardsBrowseLocationRadiusParams(params, { radius: "50" })
    assert.equal(params.get("location"), "Santa Barbara, CA")
    assert.equal(params.get("lat"), "34.42")
    assert.equal(params.get("radius"), "50")
  })

  it("drops coords when a typed place has no anchor so the server can geocode", () => {
    const params = new URLSearchParams("lat=34.42&lng=-119.7")
    applyBoardsBrowseLocationRadiusParams(params, {
      location: "93101",
      radius: "25",
    })
    assert.equal(params.get("location"), "93101")
    assert.equal(params.get("lat"), null)
    assert.equal(params.get("lng"), null)
    assert.equal(params.get("radius"), "25")
  })

  it("clears geo when location is emptied", () => {
    const params = new URLSearchParams(
      "location=SB&lat=34&lng=-119&radius=25&pickup=1",
    )
    applyBoardsBrowseLocationRadiusParams(params, { location: "" })
    assert.equal(params.get("location"), null)
    assert.equal(params.get("lat"), null)
    assert.equal(params.get("radius"), null)
    assert.equal(params.get("pickup"), null)
    assert.equal(params.get("home"), BOARDS_BROWSE_HOME_OFF)
  })
})
