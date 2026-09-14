import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractListingBrandModelCandidates,
  isJunkBrandLabel,
  isJunkModelLabel,
} from "./listing-brand-model-candidates.ts"

describe("junk brand/model labels", () => {
  it("rejects generic and dimension-only labels", () => {
    assert.equal(isJunkBrandLabel("custom"), true)
    assert.equal(isJunkBrandLabel("surfboard"), true)
    assert.equal(isJunkBrandLabel("6'2"), true)
    assert.equal(isJunkBrandLabel("Lost"), false)
    assert.equal(isJunkModelLabel("fish"), true)
    assert.equal(isJunkModelLabel("Custom"), true)
    assert.equal(isJunkModelLabel("RNF"), false)
    assert.equal(isJunkModelLabel("Lane Splitter"), false)
  })
})

describe("extractListingBrandModelCandidates", () => {
  it("prefers seller brand/model fields", () => {
    const hit = extractListingBrandModelCandidates({
      title: "6'0 fish great condition",
      brand: "Lost",
      model: "RNF",
    })
    assert.deepEqual(hit, {
      brandName: "Lost",
      modelName: "RNF",
      source: "seller_fields",
    })
  })

  it("ignores junk seller fields and does not invent from the title", () => {
    const hit = extractListingBrandModelCandidates({
      title: "6'0 groveler",
      brand: "custom",
      model: "fish",
    })
    assert.equal(hit.brandName, null)
    assert.equal(hit.modelName, null)
    assert.equal(hit.source, "title")
  })
})
