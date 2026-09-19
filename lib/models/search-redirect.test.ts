import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { MarketplaceModelPageRedirectInput } from "./search-redirect.ts"
import { marketplaceModelPageHrefFromParsed } from "./search-redirect.ts"

function parsed(
  overrides: Partial<MarketplaceModelPageRedirectInput> = {},
): MarketplaceModelPageRedirectInput {
  return {
    raw: "lane splitter",
    cleaned: "lane splitter",
    brand: {
      id: "brand-1",
      name: "Chris Christenson",
      slug: "christenson-surfboards",
    },
    model: {
      id: "model-1",
      name: "Lane Splitter",
      brandId: "brand-1",
    },
    lengthInches: null,
    residualText: "",
    sectionIntent: null,
    styleIntent: [],
    ...overrides,
  }
}

describe("marketplaceModelPageHrefFromParsed", () => {
  it("sends a clean model lookup to the model page", () => {
    assert.equal(
      marketplaceModelPageHrefFromParsed(parsed()),
      "/christenson-surfboards/lane-splitter",
    )
    assert.equal(
      marketplaceModelPageHrefFromParsed(
        parsed({
          raw: "christenson lane splitter",
          cleaned: "christenson lane splitter",
        }),
      ),
      "/christenson-surfboards/lane-splitter",
    )
  })

  it("keeps listing search when the query still has extra intent", () => {
    assert.equal(
      marketplaceModelPageHrefFromParsed(parsed({ lengthInches: 78 })),
      null,
    )
    assert.equal(
      marketplaceModelPageHrefFromParsed(parsed({ residualText: "used" })),
      null,
    )
    assert.equal(
      marketplaceModelPageHrefFromParsed(parsed({ sectionIntent: "fins" })),
      null,
    )
    assert.equal(
      marketplaceModelPageHrefFromParsed(parsed({ styleIntent: ["fish"] })),
      null,
    )
  })

  it("does not send prefix completions to a longer catalog name", () => {
    assert.equal(
      marketplaceModelPageHrefFromParsed(
        parsed({
          raw: "dumpster",
          cleaned: "dumpster",
          brand: { id: "ci", name: "Channel Islands", slug: "channel-islands-surfboards" },
          model: { id: "dd", name: "Dumpster Diver", brandId: "ci" },
        }),
      ),
      null,
    )
  })

  it("returns null without a unique model and brand slug", () => {
    assert.equal(marketplaceModelPageHrefFromParsed(null), null)
    assert.equal(marketplaceModelPageHrefFromParsed(parsed({ model: null })), null)
    assert.equal(
      marketplaceModelPageHrefFromParsed(
        parsed({ brand: { id: "b", name: "Boards", slug: "boards" } }),
      ),
      null,
    )
  })
})
