import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  brandDirectoryColumnsForWidth,
  brandModelColumnsForWidth,
  clampPageSize,
  viewportFitPageSize,
} from "./viewport-fit-page-size.ts"

describe("viewportFitPageSize", () => {
  it("fills rows x columns that fit under the pager reserve", () => {
    // 900 viewport, list at 300, 72 pager + 24 pad => 504 usable
    // row stride 84 => 6 rows; 4 cols => 24
    assert.equal(
      viewportFitPageSize({
        viewportHeight: 900,
        listTop: 300,
        rowStridePx: 84,
        columns: 4,
        pagerReservePx: 72,
        bottomPadPx: 24,
      }),
      24,
    )
  })

  it("falls back to one row of columns when almost no space remains", () => {
    assert.equal(
      viewportFitPageSize({
        viewportHeight: 800,
        listTop: 780,
        rowStridePx: 90,
        columns: 3,
        pagerReservePx: 72,
        minPageSize: 3,
      }),
      3,
    )
  })

  it("clamps to min/max", () => {
    assert.equal(clampPageSize(2, 4, 20), 4)
    assert.equal(clampPageSize(50, 4, 20), 20)
  })
})

describe("column helpers", () => {
  it("matches directory and model breakpoints", () => {
    assert.equal(brandDirectoryColumnsForWidth(500), 1)
    assert.equal(brandDirectoryColumnsForWidth(700), 2)
    assert.equal(brandDirectoryColumnsForWidth(900), 3)
    assert.equal(brandDirectoryColumnsForWidth(1100), 4)
    assert.equal(brandDirectoryColumnsForWidth(1400), 5)
    assert.equal(brandModelColumnsForWidth(500), 1)
    assert.equal(brandModelColumnsForWidth(800), 2)
    assert.equal(brandModelColumnsForWidth(1200), 3)
  })
})
