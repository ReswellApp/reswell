import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  canUseModelTextFallback,
  listingTitleMatchesModel,
  matchCatalogModelForListingPage,
} from "./match.ts"

describe("listingTitleMatchesModel", () => {
  it("matches Christenson Lane Splitter titles", () => {
    assert.equal(listingTitleMatchesModel("6'6 Christenson Lane Splitter", "Lane Splitter"), true)
    assert.equal(listingTitleMatchesModel("Lane Splitter Swallow", "Lane Splitter"), true)
    assert.equal(listingTitleMatchesModel("Pyzel Ghost", "Lane Splitter"), false)
  })
})

describe("matchCatalogModelForListingPage", () => {
  const models = [{ name: "Lane Splitter" }, { name: "Cafe Racer 1.0" }]

  it("matches a listing model to the catalog page name", () => {
    assert.equal(matchCatalogModelForListingPage(models, "Lane Splitter")?.name, "Lane Splitter")
    assert.equal(matchCatalogModelForListingPage(models, "lane-splitter")?.name, "Lane Splitter")
    assert.equal(matchCatalogModelForListingPage(models, "LANE SPLITTER")?.name, "Lane Splitter")
    assert.equal(matchCatalogModelForListingPage(models, "Lane Splitter Swallow"), null)
  })
})

describe("canUseModelTextFallback", () => {
  it("skips short single-token names that would over-match", () => {
    assert.equal(canUseModelTextFallback("Fish"), false)
    assert.equal(canUseModelTextFallback("OP1"), false)
    assert.equal(canUseModelTextFallback("Lane Splitter"), true)
    assert.equal(canUseModelTextFallback("Nautilus"), true)
  })
})
