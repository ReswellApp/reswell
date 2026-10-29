import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPublicCatalogModelName } from "./public-catalog-model.ts"

describe("isPublicCatalogModelName", () => {
  it("keeps named production models", () => {
    assert.equal(isPublicCatalogModelName("Insanity"), true)
    assert.equal(isPublicCatalogModelName("Lightbender"), true)
    assert.equal(isPublicCatalogModelName("Ledge"), true)
    assert.equal(isPublicCatalogModelName("Bom Dia (Regular)"), true)
    assert.equal(isPublicCatalogModelName("Sunstone (Hovercraft)"), true)
  })

  it("hides used-board inventory SKUs", () => {
    assert.equal(isPublicCatalogModelName("Insanity (Used)"), false)
    assert.equal(isPublicCatalogModelName("Lightbender (Wing) (Used)"), false)
    assert.equal(isPublicCatalogModelName("Ledge Twinzer (Used)"), false)
    assert.equal(isPublicCatalogModelName("1/2 2.Pro PU FCS2 - Used Team Board"), false)
    assert.equal(isPublicCatalogModelName("16005 - USED"), false)
    assert.equal(isPublicCatalogModelName("Used Inferno 72"), false)
    assert.equal(isPublicCatalogModelName("Lightly Used Inferno 72"), false)
  })

  it("hides custom deposits and ding repair", () => {
    assert.equal(isPublicCatalogModelName("Custom Order"), false)
    assert.equal(isPublicCatalogModelName("Order deposit"), false)
    assert.equal(isPublicCatalogModelName("Ding repair"), false)
  })

  it("rejects empty names", () => {
    assert.equal(isPublicCatalogModelName(""), false)
    assert.equal(isPublicCatalogModelName("  "), false)
    assert.equal(isPublicCatalogModelName(null), false)
  })
})
