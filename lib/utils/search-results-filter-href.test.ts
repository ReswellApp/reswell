import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { searchResultsFilterHref } from "./search-results-filter-href.ts"

describe("searchResultsFilterHref", () => {
  it("opens board browse with the model and length already applied", () => {
    assert.equal(
      searchResultsFilterHref({
        query: "twinsman 5'5",
        section: null,
        brandModelId: "model-1",
        brandId: "brand-1",
        lengthToken: "5'5",
      }),
      "/boards?q=twinsman+5%275&brandModelId=model-1&dimLength=5%275",
    )
  })

  it("uses brand id when the query has no catalog model", () => {
    assert.equal(
      searchResultsFilterHref({
        query: "album surf",
        section: "surfboards",
        brandId: "brand-1",
      }),
      "/boards?q=album+surf&brandId=brand-1",
    )
  })

  it("sends section searches to that section's browse filters", () => {
    assert.equal(
      searchResultsFilterHref({
        query: "futures honeycomb",
        section: "fins",
        brandId: "brand-1",
      }),
      "/fins?q=futures+honeycomb",
    )
  })
})
