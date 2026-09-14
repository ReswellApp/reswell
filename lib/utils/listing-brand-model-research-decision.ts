import {
  isJunkBrandLabel,
  isJunkModelLabel,
} from "./listing-brand-model-candidates.ts"
import type { ListingBrandModelResearchResult } from "../validations/listing-brand-model-research.ts"

export type OfficialSiteVerification = {
  ok: boolean
  blocked: boolean
  fetchFailed: boolean
  modelMentioned: boolean
  host: string | null
}

export type CatalogCreateDecision =
  | { action: "attach_existing" }
  | {
      action: "create_and_attach"
      createBrand: boolean
      createModel: boolean
      brandName: string
      modelName: string | null
      websiteUrl: string
      locationLabel: string | null
      founderName: string | null
      shortDescription: string | null
    }
  | { action: "queue_review"; reason: string; notes: string | null }

export type CatalogCreateDecisionInput = {
  hasCatalogBrand: boolean
  hasCatalogModel: boolean
  extractedBrandName: string | null
  extractedModelName: string | null
  research: ListingBrandModelResearchResult | null
  officialSite: OfficialSiteVerification | null
}

/**
 * Pure gate for auto-creating catalog rows. High-confidence + official site
 * only. Low-confidence or unverified sources must queue — never invent.
 */
export function decideListingBrandModelCatalogCreate(
  input: CatalogCreateDecisionInput,
): CatalogCreateDecision {
  if (input.hasCatalogBrand && input.hasCatalogModel) {
    return { action: "attach_existing" }
  }

  const research = input.research
  if (!research) {
    return {
      action: "queue_review",
      reason: input.extractedBrandName ? "research_unavailable" : "no_extractable_brand",
      notes: input.extractedBrandName
        ? "Listing has a brand label but research is disabled or failed."
        : "No seller brand/model label and no confirmed extract.",
    }
  }

  if (research.skip_reason) {
    return {
      action: "queue_review",
      reason: research.skip_reason,
      notes: research.notes,
    }
  }

  if (research.confidence !== "high") {
    return {
      action: "queue_review",
      reason: "low_confidence",
      notes: research.notes,
    }
  }

  if (!research.is_real_shaper || !research.is_category_match) {
    return {
      action: "queue_review",
      reason: research.is_real_shaper ? "wrong_category" : "not_a_shaper",
      notes: research.notes,
    }
  }

  const brandName = research.brand_name?.trim() || input.extractedBrandName
  if (!brandName || isJunkBrandLabel(brandName)) {
    return {
      action: "queue_review",
      reason: "no_extractable_brand",
      notes: research.notes,
    }
  }

  const websiteUrl = research.official_website_url?.trim() ?? ""
  if (!websiteUrl) {
    return {
      action: "queue_review",
      reason: "no_official_site",
      notes: research.notes,
    }
  }

  const site = input.officialSite
  if (!site || site.blocked) {
    return {
      action: "queue_review",
      reason: "unofficial_source",
      notes: research.notes ?? "Official URL is a retailer, marketplace, or social page.",
    }
  }
  if (site.fetchFailed || !site.ok) {
    return {
      action: "queue_review",
      reason: "official_site_unverified",
      notes: research.notes ?? "Could not fetch the official site from this environment.",
    }
  }

  const modelName = research.model_name?.trim() || input.extractedModelName
  const usableModel = modelName && !isJunkModelLabel(modelName) ? modelName : null
  const createBrand = !input.hasCatalogBrand
  const createModel = !input.hasCatalogModel && Boolean(usableModel) && site.modelMentioned

  if (!createBrand && !createModel) {
    if (!input.hasCatalogModel && usableModel && !site.modelMentioned) {
      return {
        action: "queue_review",
        reason: "model_not_on_official_site",
        notes:
          research.notes ??
          "Named model was not found on the official site — will not invent a catalog row.",
      }
    }
    return {
      action: "queue_review",
      reason: "low_confidence",
      notes: research.notes,
    }
  }

  return {
    action: "create_and_attach",
    createBrand,
    createModel,
    brandName,
    modelName: createModel ? usableModel : null,
    websiteUrl,
    locationLabel: research.location_label?.trim() || null,
    founderName: research.founder_name?.trim() || null,
    shortDescription: research.short_description?.trim() || null,
  }
}
