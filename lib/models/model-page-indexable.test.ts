import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  hasIndexableModelPriceGuide,
  isModelPageIndexable,
  modelHasIndexableProductDetail,
  modelSitemapCandidateIsIndexable,
  priceGuideRowIsIndexable,
  selectIndexableModelSitemapEntries,
  variantHasIndexableDetail,
  type ModelSitemapIndexSignals,
} from "./model-page-indexable.ts"

const emptySignals: ModelSitemapIndexSignals = {
  listingModelIds: new Set(),
  detailModelIds: new Set(),
  priceGuideModelIds: new Set(),
  reviewKeys: new Set(),
}

describe("isModelPageIndexable", () => {
  const empty = {
    listingCount: 0,
    soldListingCount: 0,
    reviewCount: 0,
    hasProductDetail: false,
    hasPriceGuide: false,
  }

  it("skips a shell that is only the model name", () => {
    assert.equal(isModelPageIndexable(empty), false)
  })

  it("keeps a model with a listing, a sale, a review, specs, or a price guide", () => {
    assert.equal(isModelPageIndexable({ ...empty, listingCount: 1 }), true)
    assert.equal(isModelPageIndexable({ ...empty, soldListingCount: 1 }), true)
    assert.equal(isModelPageIndexable({ ...empty, reviewCount: 2 }), true)
    assert.equal(isModelPageIndexable({ ...empty, hasProductDetail: true }), true)
    assert.equal(isModelPageIndexable({ ...empty, hasPriceGuide: true }), true)
  })
})

describe("model product detail", () => {
  it("ignores a variant that only carries the default fin box", () => {
    assert.equal(variantHasIndexableDetail({}), false)
    assert.equal(variantHasIndexableDetail({ fin_boxes: "" }), false)
    assert.equal(variantHasIndexableDetail({ fin_boxes: "thruster" }), true)
    assert.equal(variantHasIndexableDetail({ length_label: "5'10\"" }), true)
    assert.equal(variantHasIndexableDetail({ material: "pu" }), true)
  })

  it("treats a written description as detail", () => {
    assert.equal(
      modelHasIndexableProductDetail({ description: "  A step-up with hold. ", variants: [] }),
      true,
    )
    assert.equal(modelHasIndexableProductDetail({ description: "  ", variants: [] }), false)
  })
})

describe("price guide indexability", () => {
  it("requires a range, a sale, a sampled band, or copy", () => {
    assert.equal(
      hasIndexableModelPriceGuide({
        typical: { low_usd: null, high_usd: null },
        condition_bands: [],
        recent_sold: [],
        entry: null,
      }),
      false,
    )
    assert.equal(
      hasIndexableModelPriceGuide({
        typical: { low_usd: 400, high_usd: 650 },
        condition_bands: [],
        recent_sold: [],
        entry: null,
      }),
      true,
    )
    assert.equal(
      priceGuideRowIsIndexable({
        typical_low_usd: "0",
        typical_high_usd: null,
        headline: null,
        summary: null,
        body: null,
        condition_bands: [{ sample_count: 3 }],
      }),
      true,
    )
    assert.equal(
      priceGuideRowIsIndexable({
        typical_low_usd: null,
        typical_high_usd: null,
        headline: "  ",
        summary: null,
        body: null,
        condition_bands: [],
      }),
      false,
    )
  })
})

describe("selectIndexableModelSitemapEntries", () => {
  const shell = {
    id: "shell",
    brandSlug: "album",
    modelSlug: "twinzer",
    description: null,
  }
  const described = {
    id: "described",
    brandSlug: "Christenson",
    modelSlug: "Lane-Splitter",
    description: "Outline and a bit of volume.",
  }

  it("drops empty models and keeps models with a real signal", () => {
    const selected = selectIndexableModelSitemapEntries(
      [shell, described, { ...shell, id: "sold", brandSlug: "warner", modelSlug: "semi-pro" }],
      { ...emptySignals, listingModelIds: new Set(["sold"]) },
    )
    assert.deepEqual(selected, [
      { brandSlug: "christenson", modelSlug: "lane-splitter" },
      { brandSlug: "warner", modelSlug: "semi-pro" },
    ])
  })

  it("keeps a reviewed model and skips a reserved first segment", () => {
    const selected = selectIndexableModelSitemapEntries(
      [
        shell,
        { id: "boards", brandSlug: "boards", modelSlug: "shortboard", description: "nope" },
      ],
      { ...emptySignals, reviewKeys: new Set(["album/twinzer"]) },
    )
    assert.deepEqual(selected, [{ brandSlug: "album", modelSlug: "twinzer" }])
  })

  it("fails open when a signal query could not be read", () => {
    assert.equal(
      modelSitemapCandidateIsIndexable(shell, { ...emptySignals, listingModelIds: "unknown" }),
      true,
    )
  })
})
