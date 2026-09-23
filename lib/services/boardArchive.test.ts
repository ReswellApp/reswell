import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatBoardArchiveVariantSummary,
  sanitizeBoardArchiveQuery,
} from "./boardArchiveDisplay.ts"

describe("sanitizeBoardArchiveQuery", () => {
  it("drops ilike wildcards and filter punctuation", () => {
    assert.equal(sanitizeBoardArchiveQuery("  Lost % RNF_  "), "Lost RNF")
    assert.equal(sanitizeBoardArchiveQuery("Ghost, (5'10)"), "Ghost 5'10")
  })

  it("caps the length", () => {
    assert.equal(sanitizeBoardArchiveQuery("a".repeat(100)).length, 80)
  })
})

describe("formatBoardArchiveVariantSummary", () => {
  it("joins the catalog size labels", () => {
    assert.equal(
      formatBoardArchiveVariantSummary({
        length_label: "5'10",
        width_label: "18 1/2",
        thickness_label: "2 1/4",
        volume_label: "28.5L",
      }),
      "5'10 × 18 1/2 × 2 1/4 — 28.5L",
    )
  })

  it("returns null when no size was stored", () => {
    assert.equal(formatBoardArchiveVariantSummary(null), null)
  })
})
