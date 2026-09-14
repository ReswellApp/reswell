import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { ListingBrandModelResearchResult } from "../validations/listing-brand-model-research.ts"
import { decideListingBrandModelCatalogCreate } from "./listing-brand-model-research-decision.ts"

const highConfidence: ListingBrandModelResearchResult = {
  confidence: "high",
  is_real_shaper: true,
  is_category_match: true,
  official_website_url: "https://www.barahonasurfboards.com",
  brand_name: "Barahona Surfboards",
  model_name: "Twin Pin",
  location_label: "San Clemente, California",
  founder_name: null,
  short_description: "Independent San Clemente shaper.",
  skip_reason: null,
  notes: null,
}

describe("decideListingBrandModelCatalogCreate", () => {
  it("attaches when both catalog links already exist", () => {
    const decision = decideListingBrandModelCatalogCreate({
      hasCatalogBrand: true,
      hasCatalogModel: true,
      extractedBrandName: "Lost",
      extractedModelName: "RNF",
      research: null,
      officialSite: null,
    })
    assert.equal(decision.action, "attach_existing")
  })

  it("queues when research is low confidence", () => {
    const decision = decideListingBrandModelCatalogCreate({
      hasCatalogBrand: false,
      hasCatalogModel: false,
      extractedBrandName: "Maybe Shapes",
      extractedModelName: null,
      research: { ...highConfidence, confidence: "low", skip_reason: null },
      officialSite: { ok: true, blocked: false, fetchFailed: false, modelMentioned: true, host: "example.com" },
    })
    assert.deepEqual(decision, {
      action: "queue_review",
      reason: "low_confidence",
      notes: null,
    })
  })

  it("queues retailer / social hosts", () => {
    const decision = decideListingBrandModelCatalogCreate({
      hasCatalogBrand: false,
      hasCatalogModel: false,
      extractedBrandName: "Lost",
      extractedModelName: "RNF",
      research: highConfidence,
      officialSite: {
        ok: false,
        blocked: true,
        fetchFailed: false,
        modelMentioned: false,
        host: "instagram.com",
      },
    })
    assert.equal(decision.action, "queue_review")
    if (decision.action === "queue_review") {
      assert.equal(decision.reason, "unofficial_source")
    }
  })

  it("creates brand+model only when the official site mentions the model", () => {
    const decision = decideListingBrandModelCatalogCreate({
      hasCatalogBrand: false,
      hasCatalogModel: false,
      extractedBrandName: "Barahona",
      extractedModelName: "Twin Pin",
      research: highConfidence,
      officialSite: {
        ok: true,
        blocked: false,
        fetchFailed: false,
        modelMentioned: true,
        host: "barahonasurfboards.com",
      },
    })
    assert.equal(decision.action, "create_and_attach")
    if (decision.action === "create_and_attach") {
      assert.equal(decision.createBrand, true)
      assert.equal(decision.createModel, true)
      assert.equal(decision.brandName, "Barahona Surfboards")
      assert.equal(decision.modelName, "Twin Pin")
    }
  })

  it("does not invent a model that is missing from the official site", () => {
    const decision = decideListingBrandModelCatalogCreate({
      hasCatalogBrand: true,
      hasCatalogModel: false,
      extractedBrandName: "Barahona",
      extractedModelName: "Twin Pin",
      research: highConfidence,
      officialSite: {
        ok: true,
        blocked: false,
        fetchFailed: false,
        modelMentioned: false,
        host: "barahonasurfboards.com",
      },
    })
    assert.equal(decision.action, "queue_review")
    if (decision.action === "queue_review") {
      assert.equal(decision.reason, "model_not_on_official_site")
    }
  })

  it("can create a brand without a model when the model is unverified", () => {
    const decision = decideListingBrandModelCatalogCreate({
      hasCatalogBrand: false,
      hasCatalogModel: false,
      extractedBrandName: "Barahona",
      extractedModelName: null,
      research: { ...highConfidence, model_name: null },
      officialSite: {
        ok: true,
        blocked: false,
        fetchFailed: false,
        modelMentioned: false,
        host: "barahonasurfboards.com",
      },
    })
    assert.equal(decision.action, "create_and_attach")
    if (decision.action === "create_and_attach") {
      assert.equal(decision.createBrand, true)
      assert.equal(decision.createModel, false)
      assert.equal(decision.modelName, null)
    }
  })
})
