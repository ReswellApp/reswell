import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  boardsBrowseHasLatLng,
  boardsBrowseNeedsGeocodePersist,
  boardsBrowsePathWithSearchParams,
  boardsBrowseSearchParamsWithGeocode,
  formatBoardsBrowseCoord,
  isValidBoardsBrowseLatLng,
  normalizeForwardGeocodePlaceKey,
  parseBoardsBrowseCoord,
} from "./boards-browse-geocode.ts"

describe("normalizeForwardGeocodePlaceKey", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    assert.equal(normalizeForwardGeocodePlaceKey("  San   Diego, CA "), "san diego, ca")
  })
})

describe("parseBoardsBrowseCoord", () => {
  it("parses finite numbers and rejects junk", () => {
    assert.equal(parseBoardsBrowseCoord("32.7157"), 32.7157)
    assert.equal(parseBoardsBrowseCoord("  -117.1611 "), -117.1611)
    assert.equal(parseBoardsBrowseCoord(""), undefined)
    assert.equal(parseBoardsBrowseCoord("abc"), undefined)
    assert.equal(parseBoardsBrowseCoord(undefined), undefined)
  })
})

describe("isValidBoardsBrowseLatLng", () => {
  it("accepts San Diego and rejects out-of-range", () => {
    assert.equal(isValidBoardsBrowseLatLng(32.7157, -117.1611), true)
    assert.equal(isValidBoardsBrowseLatLng(91, -117), false)
    assert.equal(isValidBoardsBrowseLatLng(32, 181), false)
  })
})

describe("boardsBrowseHasLatLng", () => {
  it("requires both valid coordinates", () => {
    assert.equal(boardsBrowseHasLatLng("32.7", "-117.1"), true)
    assert.equal(boardsBrowseHasLatLng("32.7", undefined), false)
    assert.equal(boardsBrowseHasLatLng("91", "-117.1"), false)
  })
})

describe("boardsBrowseNeedsGeocodePersist", () => {
  it("is true only for a place string without usable coords", () => {
    assert.equal(boardsBrowseNeedsGeocodePersist({ location: "San Diego" }), true)
    assert.equal(
      boardsBrowseNeedsGeocodePersist({ location: "San Diego", lat: "32.7", lng: "-117.1" }),
      false,
    )
    assert.equal(boardsBrowseNeedsGeocodePersist({ location: "x" }), false)
    assert.equal(boardsBrowseNeedsGeocodePersist({}), false)
  })
})

describe("boardsBrowseSearchParamsWithGeocode", () => {
  it("persists lat/lng without dropping other filters", () => {
    const next = boardsBrowseSearchParamsWithGeocode(
      { location: "San Diego", type: "shortboard", page: "2", lat: "1", lng: "2" },
      { lat: 32.715736, lng: -117.161087 },
    )
    assert.equal(next.get("location"), "San Diego")
    assert.equal(next.get("type"), "shortboard")
    assert.equal(next.get("page"), "2")
    assert.equal(next.get("lat"), formatBoardsBrowseCoord(32.715736))
    assert.equal(next.get("lng"), formatBoardsBrowseCoord(-117.161087))
  })

  it("builds a browse href", () => {
    const next = boardsBrowseSearchParamsWithGeocode(
      { location: "Encinitas" },
      { lat: 33.03699, lng: -117.29198 },
    )
    assert.equal(
      boardsBrowsePathWithSearchParams("/boards", next),
      `/boards?location=Encinitas&lat=${formatBoardsBrowseCoord(33.03699)}&lng=${formatBoardsBrowseCoord(-117.29198)}`,
    )
  })
})
