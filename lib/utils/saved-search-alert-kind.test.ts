import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  brandSavedSearchCriteria,
  findSavedSearchForBrand,
  findSavedSearchForModel,
  inferSavedSearchAlertKind,
  modelSavedSearchCriteria,
  savedSearchMatchesBrand,
  savedSearchMatchesModel,
} from "./saved-search-alert-kind.ts"

const MODEL_ID = "11111111-1111-4111-8111-111111111111"
const BRAND_ID = "22222222-2222-4222-8222-222222222222"

describe("inferSavedSearchAlertKind", () => {
  it("prefers the stored alertKind", () => {
    assert.equal(inferSavedSearchAlertKind({ alertKind: "search", brandModelId: MODEL_ID }), "search")
  })

  it("infers model from brandModelId", () => {
    assert.equal(inferSavedSearchAlertKind({ brandModelId: MODEL_ID }), "model")
  })

  it("infers brand from brandId without a model", () => {
    assert.equal(inferSavedSearchAlertKind({ brandId: BRAND_ID }), "brand")
  })

  it("falls back to search", () => {
    assert.equal(inferSavedSearchAlertKind({ q: "fish" }), "search")
  })
})

describe("savedSearchMatchesModel / Brand", () => {
  it("matches a model snapshot by catalog id", () => {
    assert.equal(savedSearchMatchesModel({ brandModelId: MODEL_ID }, MODEL_ID), true)
    assert.equal(savedSearchMatchesModel({ brandModelId: BRAND_ID }, MODEL_ID), false)
  })

  it("does not treat a model save as a brand save", () => {
    assert.equal(
      savedSearchMatchesBrand({ brandId: BRAND_ID, brandModelId: MODEL_ID }, BRAND_ID),
      false,
    )
    assert.equal(savedSearchMatchesBrand({ brandId: BRAND_ID }, BRAND_ID), true)
  })

  it("finds the matching row", () => {
    const rows = [
      { id: "a", criteria: { brandId: BRAND_ID } },
      { id: "b", criteria: { brandId: BRAND_ID, brandModelId: MODEL_ID } },
    ]
    assert.equal(findSavedSearchForModel(rows, MODEL_ID)?.id, "b")
    assert.equal(findSavedSearchForBrand(rows, BRAND_ID)?.id, "a")
  })
})

describe("entity criteria builders", () => {
  it("stamps model alerts with catalog ids", () => {
    const criteria = modelSavedSearchCriteria({
      brandName: "Album",
      brandId: BRAND_ID,
      brandSlug: "albumsurf",
      modelName: "Twinsman",
      brandModelId: MODEL_ID,
      modelSlug: "twinsman",
      section: "surfboards",
    })
    assert.equal(criteria.alertKind, "model")
    assert.equal(criteria.brandModelId, MODEL_ID)
    assert.equal(criteria.modelSlug, "twinsman")
  })

  it("saves a brand across every peer section", () => {
    const criteria = brandSavedSearchCriteria({
      brandName: "Album",
      brandId: BRAND_ID,
      brandSlug: "albumsurf",
    })
    assert.equal(criteria.alertKind, "brand")
    assert.equal(criteria.anySection, true)
    assert.equal(criteria.brandId, BRAND_ID)
  })
})
