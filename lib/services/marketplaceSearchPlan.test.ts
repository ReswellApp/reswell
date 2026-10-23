import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { MarketplaceParsedQuery } from "./marketplaceQueryParse.ts"
import { buildMarketplaceSearchPlan } from "./marketplaceSearchPlan.ts"

const LOST_ID = "11111111-1111-4111-8111-111111111111"

function parsedLost(expansions: string[]): MarketplaceParsedQuery {
  return {
    raw: "lost surfboards",
    cleaned: "lost",
    brand: { id: LOST_ID, name: "Lost Surfboards", slug: "lost-surfboards" },
    model: null,
    modelIds: [],
    lengthInches: null,
    lengthToken: null,
    residualText: "",
    textQuery: "lost",
    isBrandOnly: true,
    sectionIntent: null,
    styleIntent: [],
    expansions,
  }
}

describe("marketplace search plan", () => {
  it("searches Lost by brand, not the word lost, when Mayhem is an alias", () => {
    const plan = buildMarketplaceSearchPlan({
      rawQuery: "lost surfboards",
      parsed: parsedLost(["mayhem"]),
      brand: { id: LOST_ID, name: "Lost Surfboards" },
      brandFromUrl: false,
      categoryId: null,
    })

    assert.equal(plan.useBrandInventory, false)
    assert.equal(plan.esPasses[0]?.q, "")
    assert.equal(plan.esPasses[0]?.brandId, LOST_ID)
    assert.equal(plan.esPasses[0]?.typoFallback, false)
    assert.equal(plan.esPasses[0]?.brandModelIds, null)
  })

  it("uses brand inventory when the query has no synonym expansion", () => {
    const plan = buildMarketplaceSearchPlan({
      rawQuery: "lost surfboards",
      parsed: parsedLost([]),
      brand: { id: LOST_ID, name: "Lost Surfboards" },
      brandFromUrl: false,
      categoryId: null,
    })

    assert.equal(plan.useBrandInventory, true)
    assert.equal(plan.inventoryIsFinal, false)
  })

  it("keeps a free-text query on the first pass when it is not a brand", () => {
    const plan = buildMarketplaceSearchPlan({
      rawQuery: "round pin",
      parsed: {
        raw: "round pin",
        cleaned: "round pin",
        brand: null,
        model: null,
        modelIds: [],
        lengthInches: null,
        lengthToken: null,
        residualText: "round pin",
        textQuery: "round pin",
        isBrandOnly: false,
        sectionIntent: null,
        styleIntent: [],
        expansions: [],
      },
      brand: null,
      brandFromUrl: false,
      categoryId: null,
    })

    assert.equal(plan.useBrandInventory, false)
    assert.equal(plan.esPasses[0]?.q, "round pin")
    assert.equal(plan.esPasses[0]?.brandId, null)
    assert.equal(plan.esPasses[0]?.typoFallback, false)
  })
})
