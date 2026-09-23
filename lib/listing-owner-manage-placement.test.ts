import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

describe("listing owner manage placement", () => {
  it("keeps Your listing controls in the listing column, not the top chrome island", () => {
    const island = readFileSync(
      new URL("../components/features/listings/listing-private-chrome-island.tsx", import.meta.url),
      "utf8",
    )
    const surfboard = readFileSync(
      new URL("../components/surfboard-listing-detail-page.tsx", import.meta.url),
      "utf8",
    )
    assert.doesNotMatch(island, /ListingOwnerManageActionsView/)
    assert.match(surfboard, /<ListingOwnerManageActions/)
  })
})
