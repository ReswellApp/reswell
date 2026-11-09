import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { boardsBrowseUsesTypoFallback } from "./boards-browse-typo-fallback.ts"

describe("saved search typo fallback", () => {
  it("keeps fuzzy recovery for an empty browse page", () => {
    assert.equal(boardsBrowseUsesTypoFallback({}), true)
  })

  it("does not fuzzy-match when checking whether one listing belongs in a saved search", () => {
    assert.equal(boardsBrowseUsesTypoFallback({ typoFallback: false }), false)
    assert.equal(
      boardsBrowseUsesTypoFallback({ restrictToIds: ["listing-allan"] }),
      false,
    )
    assert.equal(boardsBrowseUsesTypoFallback({ restrictToIds: [] }), true)
    assert.equal(boardsBrowseUsesTypoFallback({ restrictToIds: [""] }), true)
  })
})
