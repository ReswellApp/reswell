import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { cityLandingHrefWithBrowseParams } from "./city-landing-path.ts"

describe("cityLandingHrefWithBrowseParams", () => {
  it("keeps boards facets and drops location params", () => {
    const params = new URLSearchParams(
      "style=shortboard&minPrice=200&location=San+Diego&lat=32.7&lng=-117.1&radius=50&page=2",
    )
    assert.equal(
      cityLandingHrefWithBrowseParams("san-diego", params),
      "/reswell/san-diego?style=shortboard&minPrice=200",
    )
  })

  it("returns a bare city path when there are no other filters", () => {
    assert.equal(
      cityLandingHrefWithBrowseParams("santa-barbara", new URLSearchParams()),
      "/reswell/santa-barbara",
    )
  })
})
