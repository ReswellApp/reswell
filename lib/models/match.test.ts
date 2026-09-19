import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  canUseModelTextFallback,
  listingBelongsToCatalogModel,
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

describe("listingBelongsToCatalogModel", () => {
  const lane = { id: "lane", name: "Lane Splitter" }
  const swallow = { id: "swallow", name: "Lane Splitter Swallow" }
  const siblings = [lane, swallow]

  it("uses the tagged catalog id when present", () => {
    assert.equal(
      listingBelongsToCatalogModel({ title: "Pyzel Ghost", brand_model_id: "lane" }, lane, siblings),
      true,
    )
    assert.equal(
      listingBelongsToCatalogModel(
        { title: "Lane Splitter Swallow", brand_model_id: "swallow" },
        lane,
        siblings,
      ),
      false,
    )
  })

  it("matches untagged titles and seller model text", () => {
    assert.equal(
      listingBelongsToCatalogModel(
        { title: "5'8 Chis Christensen Lane Splitter", model: "Chris Christenson" },
        lane,
        siblings,
      ),
      true,
    )
    assert.equal(
      listingBelongsToCatalogModel({ title: "6'6 Christenson Wolverine", model: "Wolverine" }, lane),
      false,
    )
  })

  it("keeps longer sibling titles off the parent model page", () => {
    assert.equal(
      listingBelongsToCatalogModel({ title: "Lane Splitter Swallow" }, lane, siblings),
      false,
    )
    assert.equal(
      listingBelongsToCatalogModel({ title: "Lane Splitter Swallow" }, swallow, siblings),
      true,
    )
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
