import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { SellCatalogImageScanExtract } from "../validations/sellCatalogImageScan.ts"
import {
  buildSellCatalogImageScanLookup,
  clampSellCatalogImageScanConfidence,
  normalizeSellCatalogImageScanExtract,
  resolveSellCatalogImageScanCategories,
} from "./sell-catalog-image-scan.ts"

function extract(
  overrides: Partial<SellCatalogImageScanExtract> = {},
): SellCatalogImageScanExtract {
  return {
    productKind: "surfboard",
    brandText: "Channel Islands",
    modelText: "Twin Pin",
    category: "surfboards",
    visibleText: ["CI"],
    shapeHint: "fish",
    confidence: 0.86,
    summary: "Channel Islands Twin Pin",
    notes: null,
    ...overrides,
  }
}

describe("clampSellCatalogImageScanConfidence", () => {
  it("keeps 0–1 scores", () => {
    assert.equal(clampSellCatalogImageScanConfidence(0.4), 0.4)
  })

  it("treats values over 1 as percents", () => {
    assert.equal(clampSellCatalogImageScanConfidence(86), 0.86)
  })

  it("clamps invalid numbers", () => {
    assert.equal(clampSellCatalogImageScanConfidence(Number.NaN), 0)
    assert.equal(clampSellCatalogImageScanConfidence(-2), 0)
    assert.equal(clampSellCatalogImageScanConfidence(200), 1)
  })
})

describe("normalizeSellCatalogImageScanExtract", () => {
  it("drops junk brand and model labels", () => {
    const out = normalizeSellCatalogImageScanExtract(
      extract({
        brandText: "surfboard",
        modelText: "custom",
        confidence: 90,
      }),
    )
    assert.equal(out.brandText, null)
    assert.equal(out.modelText, null)
    assert.equal(out.confidence, 0.9)
  })
})

describe("buildSellCatalogImageScanLookup", () => {
  it("uses brand and model when both are present", () => {
    assert.equal(
      buildSellCatalogImageScanLookup(extract()),
      "Channel Islands Twin Pin",
    )
  })

  it("adds a useful visible token when only the brand is known", () => {
    assert.equal(
      buildSellCatalogImageScanLookup(
        extract({
          modelText: null,
          visibleText: ["Twin Pin", "used"],
        }),
      ),
      "Channel Islands Twin Pin",
    )
  })

  it("falls back to visible text when brand and model are missing", () => {
    assert.equal(
      buildSellCatalogImageScanLookup(
        extract({
          brandText: null,
          modelText: null,
          visibleText: ["True Ames", "Hobie Fish", "logo"],
        }),
      ),
      "True Ames Hobie Fish",
    )
  })

  it("returns empty when nothing searchable was read", () => {
    assert.equal(
      buildSellCatalogImageScanLookup(
        extract({
          brandText: null,
          modelText: null,
          visibleText: ["board", "used", "xx"],
        }),
      ),
      "",
    )
  })
})

describe("resolveSellCatalogImageScanCategories", () => {
  it("locks to the vision category when set", () => {
    assert.deepEqual(resolveSellCatalogImageScanCategories(extract()), ["surfboards"])
    assert.deepEqual(
      resolveSellCatalogImageScanCategories(
        extract({ productKind: "fin", category: "fins" }),
      ),
      ["fins"],
    )
  })

  it("uses productKind when category is null", () => {
    assert.deepEqual(
      resolveSellCatalogImageScanCategories(
        extract({ category: null, productKind: "fin" }),
      ),
      ["fins"],
    )
  })

  it("searches boards and fins when the photo is unclear", () => {
    assert.deepEqual(
      resolveSellCatalogImageScanCategories(
        extract({ category: null, productKind: "unknown" }),
      ),
      ["surfboards", "fins"],
    )
  })
})
