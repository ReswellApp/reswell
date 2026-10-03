import { brandPageHref } from "@/lib/brands/routes"
import { FACET_PARAM_KEYS, facetOptionLabel } from "@/lib/boards-browse-facets"
import { savedSearchAbsoluteUrl } from "@/lib/klaviyo/saved-search-url"
import { modelPageHref } from "@/lib/models/routes"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { boardSavedSearchCriteriaSummary } from "@/lib/utils/board-saved-search-browse-url"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

function facetLabels(paramKey: string, values: string[] | undefined): string {
  if (!values || values.length === 0) return ""
  return values.map((value) => facetOptionLabel(paramKey, value)).join(", ")
}

function conditionLabels(criteria: BoardSavedSearchCriteria): string {
  if (criteria.conditions && criteria.conditions.length > 0) {
    return facetLabels(FACET_PARAM_KEYS.condition, criteria.conditions)
  }
  const raw = criteria.condition?.trim()
  if (!raw || raw === "all") return ""
  return facetLabels(
    FACET_PARAM_KEYS.condition,
    raw.split(",").map((part) => part.trim()).filter(Boolean),
  )
}

function styleLabels(criteria: BoardSavedSearchCriteria): string {
  if (criteria.style && criteria.style.length > 0) {
    return facetLabels(FACET_PARAM_KEYS.style, criteria.style)
  }
  if (criteria.type && criteria.type !== "all") {
    return facetOptionLabel(FACET_PARAM_KEYS.style, criteria.type)
  }
  return ""
}

/**
 * Flat Klaviyo properties for what the shopper asked for on Board Finder.
 * Listing fields on the same event stay separate (`Brand`, `Model`, `Title`).
 */
export function boardAlertMatchFinderProperties(
  criteria: BoardSavedSearchCriteria,
  origin: string = publicSiteOriginForEmail(),
): Record<string, string | number> {
  const base = origin.replace(/\/$/, "")
  const brandSlug = criteria.brandSlug?.trim() ?? ""
  const modelSlug = criteria.modelSlug?.trim() ?? ""
  const fromBoardFinder = criteria.source === "board-finder"

  return {
    Alert_Source: fromBoardFinder ? "board-finder" : "",
    Board_Finder_URL: fromBoardFinder ? `${base}/board-finder` : "",
    Wanted_Brand: criteria.brand?.trim() ?? "",
    Wanted_Brand_ID: criteria.brandId?.trim() ?? "",
    Wanted_Brand_Slug: brandSlug,
    Wanted_Model: criteria.model?.trim() ?? "",
    Wanted_Model_ID: criteria.brandModelId?.trim() ?? "",
    Wanted_Model_Slug: modelSlug,
    Wanted_Size: facetLabels(FACET_PARAM_KEYS.length, criteria.length),
    Wanted_Style: styleLabels(criteria),
    Wanted_Condition: conditionLabels(criteria),
    Wanted_Min_Price: criteria.minPrice ?? "",
    Wanted_Max_Price: criteria.maxPrice ?? "",
    Wanted_Volume: facetLabels(FACET_PARAM_KEYS.volume, criteria.volume),
    Wanted_Construction: facetLabels(FACET_PARAM_KEYS.construction, criteria.construction),
    Wanted_Fin_System: facetLabels(FACET_PARAM_KEYS.finSystem, criteria.finSystem),
    Wanted_Summary: boardSavedSearchCriteriaSummary(criteria),
    Brand_URL: brandSlug ? `${base}${brandPageHref(brandSlug)}` : "",
    Model_URL: brandSlug && modelSlug ? `${base}${modelPageHref(brandSlug, modelSlug)}` : "",
    Search_URL: savedSearchAbsoluteUrl(criteria, base),
    Search_Query: criteria.q?.trim() ?? "",
  }
}
