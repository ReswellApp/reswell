import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  boardsBrowseEffectiveSort,
  boardsBrowseHasSidebarFilters,
  boardsBrowseSidebarFilterCount,
} from "./boards-browse-sidebar-filters.ts"

describe("boardsBrowseSidebarFilterCount", () => {
  it("does not count a home ranking preference as a sidebar filter", () => {
    assert.equal(
      boardsBrowseSidebarFilterCount({
        location: "Santa Barbara, CA, USA",
        lat: "34.42",
        lng: "-119.7",
        radius: "100",
        home: "1",
      }),
      0,
    )
    assert.equal(
      boardsBrowseHasSidebarFilters({
        location: "Santa Barbara, CA, USA",
        radius: "100",
        home: "1",
      }),
      false,
    )
  })

  it("does not count location without a hard radius", () => {
    assert.equal(
      boardsBrowseSidebarFilterCount({
        location: "Santa Barbara, CA, USA",
        lat: "34.42",
        lng: "-119.7",
      }),
      0,
    )
  })

  it("counts an explicit radius filter", () => {
    assert.equal(
      boardsBrowseSidebarFilterCount({
        location: "Santa Barbara, CA, USA",
        radius: "50",
      }),
      2,
    )
  })

  it("keeps top-picks when only a home preference is active", () => {
    assert.equal(
      boardsBrowseEffectiveSort(
        "top-picks",
        boardsBrowseHasSidebarFilters({
          location: "Santa Barbara, CA, USA",
          radius: "100",
          home: "1",
        }),
      ),
      "top-picks",
    )
  })

  it("switches top-picks to newest for a hard radius filter", () => {
    assert.equal(
      boardsBrowseEffectiveSort(
        "top-picks",
        boardsBrowseHasSidebarFilters({ location: "Santa Barbara", radius: "50" }),
      ),
      "newest",
    )
  })
})
