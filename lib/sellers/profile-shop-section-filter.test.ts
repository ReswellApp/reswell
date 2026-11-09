import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveProfileShopSectionFilter } from "./profile-shop-section-filter.ts"

describe("resolveProfileShopSectionFilter", () => {
  it("accepts peer marketplace sections", () => {
    assert.equal(resolveProfileShopSectionFilter("surfboards"), "surfboards")
    assert.equal(resolveProfileShopSectionFilter("  fins  "), "fins")
  })

  it("rejects non-peer sections", () => {
    assert.equal(resolveProfileShopSectionFilter("new"), undefined)
    assert.equal(resolveProfileShopSectionFilter(""), undefined)
  })
})
