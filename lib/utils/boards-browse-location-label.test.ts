import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { boardsBrowseLocationButtonLabel } from "./boards-browse-location-label.ts"

describe("boardsBrowseLocationButtonLabel", () => {
  it("returns Location when empty", () => {
    assert.equal(boardsBrowseLocationButtonLabel(""), "Location")
    assert.equal(boardsBrowseLocationButtonLabel("  "), "Location")
  })

  it("formats city and USPS code like Marketplace", () => {
    assert.equal(boardsBrowseLocationButtonLabel("Los Angeles, CA, USA"), "Los Angeles, CA")
    assert.equal(
      boardsBrowseLocationButtonLabel("Los Angeles, California, United States"),
      "Los Angeles, CA",
    )
    assert.equal(boardsBrowseLocationButtonLabel("San Diego, CA"), "San Diego, CA")
  })

  it("keeps a city-only label", () => {
    assert.equal(boardsBrowseLocationButtonLabel("Santa Barbara"), "Santa Barbara")
  })
})
