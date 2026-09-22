import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { formatStoredListingDimensions } from "./listing-dimensions-display.ts"
import { parseListingDimensionsColumn } from "./listing-dimensions-storage.ts"

describe("formatStoredListingDimensions", () => {
  it("formats the canonical parenthetical tuple", () => {
    assert.equal(
      formatStoredListingDimensions("(5'8 20 1/2 2 1/2 32.5L)"),
      "5'8″ × 20 1/2″ × 2 1/2″ · 32.5 L",
    )
  })

  it("formats the current v2 JSON envelope", () => {
    assert.equal(
      formatStoredListingDimensions('{"v":2,"L":"6\'0","W":"20 1/2","T":"2 5/8"}'),
      "6'0″ × 20 1/2″ × 2 5/8″",
    )
  })

  it("formats the older uppercase-V version envelope and never returns raw JSON", () => {
    const stored = '{"V":"2","L":"6\'0","W":"20 1/2","T":"2 5/8"}'
    assert.equal(formatStoredListingDimensions(stored), "6'0″ × 20 1/2″ × 2 5/8″")
    assert.ok(!formatStoredListingDimensions(stored)?.includes("{"))
  })

  it("reads volume from the canonical V key", () => {
    assert.equal(
      formatStoredListingDimensions('{"v":2,"L":"6\'0","W":"20 1/2","T":"2 5/8","V":"32"}'),
      "6'0″ × 20 1/2″ × 2 5/8″ · 32 L",
    )
  })
})

describe("parseListingDimensionsColumn", () => {
  it("treats uppercase V as version when lowercase v is missing", () => {
    const parsed = parseListingDimensionsColumn('{"V":"2","L":"6\'0","W":"20 1/2","T":"2 5/8"}')
    assert.ok(parsed)
    assert.equal(parsed.boardLength.includes("6"), true)
    assert.equal(parsed.boardWidthInches, "20 1/2")
    assert.equal(parsed.boardThicknessInches, "2 5/8")
    assert.equal(parsed.boardVolumeL, "")
  })
})
