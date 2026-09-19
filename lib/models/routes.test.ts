import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  findBrandModelBySlug,
  isModelPagePathname,
  isReservedModelPageBrandSegment,
  modelPageHref,
  modelPageSlug,
  parseModelPageTab,
} from "./routes.ts"

describe("modelPageSlug", () => {
  it("slugifies catalog names", () => {
    assert.equal(modelPageSlug("Lane Splitter"), "lane-splitter")
    assert.equal(modelPageSlug("Lane Splitter Swallow"), "lane-splitter-swallow")
  })
})

describe("findBrandModelBySlug", () => {
  it("matches the catalog row for a model slug", () => {
    const models = [{ name: "Cafe Racer 1.0" }, { name: "Lane Splitter" }]
    assert.equal(findBrandModelBySlug(models, "lane-splitter")?.name, "Lane Splitter")
    assert.equal(findBrandModelBySlug(models, "missing"), null)
  })
})

describe("modelPageHref", () => {
  it("omits the default listings hash and keeps the others as section hashes", () => {
    assert.equal(
      modelPageHref("christenson-surfboards", "lane-splitter"),
      "/christenson-surfboards/lane-splitter",
    )
    assert.equal(
      modelPageHref("christenson-surfboards", "lane-splitter", "details"),
      "/christenson-surfboards/lane-splitter#details",
    )
    assert.equal(
      modelPageHref("christenson-surfboards", "lane-splitter", "price-guide"),
      "/christenson-surfboards/lane-splitter#price-guide",
    )
    assert.equal(
      modelPageHref("christenson-surfboards", "lane-splitter", "reviews"),
      "/christenson-surfboards/lane-splitter#reviews",
    )
  })
})

describe("parseModelPageTab", () => {
  it("defaults unknown values to listings and accepts hashes", () => {
    assert.equal(parseModelPageTab(undefined), "listings")
    assert.equal(parseModelPageTab("details"), "details")
    assert.equal(parseModelPageTab("#price-guide"), "price-guide")
    assert.equal(parseModelPageTab("nope"), "listings")
  })
})

describe("reserved brand segments", () => {
  it("keeps existing app routes from being treated as brand slugs", () => {
    assert.equal(isReservedModelPageBrandSegment("boards"), true)
    assert.equal(isReservedModelPageBrandSegment("l"), true)
    assert.equal(isReservedModelPageBrandSegment("christenson-surfboards"), false)
    assert.equal(isModelPagePathname("/christenson-surfboards/lane-splitter"), true)
    assert.equal(isModelPagePathname("/boards/shortboard"), false)
    assert.equal(isModelPagePathname("/brands/christenson-surfboards"), false)
  })
})
