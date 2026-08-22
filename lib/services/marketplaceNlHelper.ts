/**
 * Parallel NL search helper (Gemini via AI Gateway).
 *
 * Does not run on the boards browse critical path — the client calls
 * `/api/search/nl-helper` after first paint to refine filters that rules miss
 * (condition, construction, location, shipping, fuzzy brand/model, synonym typos).
 */

import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  catalogLabelGroundedInQuery,
  formatBoardLengthTokenFromInches,
  parseMarketplaceQuery,
} from "@/lib/services/marketplaceQueryParse"
import {
  isMarketplaceNlSearchEnabled,
  marketplaceQueryLikelyNeedsLlm,
  nlIntentToAppliedLabels,
  understandMarketplaceQueryWithLlm,
} from "@/lib/services/marketplaceQueryUnderstand"
import { resolveDirectoryBrandRowFromLabel } from "@/lib/services/brandDirectorySearch"
import {
  extractPriceFiltersFromQuery,
  sanitizeNlPriceAgainstQuery,
} from "@/lib/utils/marketplace-price-query"
import { extractLengthBoundsFromQuery } from "@/lib/utils/marketplace-length-query"
import { LENGTH_BUCKETS } from "@/lib/boards-browse-facets"
import { extractConstructionsFromQuery } from "@/lib/utils/marketplace-construction-query"
import {
  extractFinSetupsFromQuery,
  extractFinSystemsFromQuery,
} from "@/lib/utils/marketplace-fin-query"
import { extractTailShapesFromQuery } from "@/lib/utils/marketplace-tail-query"
import { extractBoardStylesFromQuery } from "@/lib/utils/marketplace-style-query"
import { totalBoardLengthInchesFromCombinedInput } from "@/lib/board-measurements"
import type { MarketplaceNlHelperRefine } from "@/lib/utils/marketplace-nl-helper-refine"

export type { MarketplaceNlHelperRefine } from "@/lib/utils/marketplace-nl-helper-refine"

export type MarketplaceNlHelperResult = {
  ok: true
  skipped?: boolean
  reason?: string
  appliedLabels: string[]
  summary: string
  /** URL search params to merge when not already present (progressive refine). */
  refine: MarketplaceNlHelperRefine
}

function uniqueCsv(values: string[]): string | undefined {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of values) {
    const t = v.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out.length > 0 ? out.join(",") : undefined
}

/**
 * Run Gemini NL understand and map to applied chips + optional URL refine params.
 */
export async function runMarketplaceNlHelper(
  supabase: SupabaseClient,
  rawQuery: string,
): Promise<MarketplaceNlHelperResult> {
  const q = (rawQuery || "").trim()
  if (q.length < 2) {
    return { ok: true, skipped: true, reason: "empty_query", appliedLabels: [], summary: "", refine: {} }
  }

  if (!isMarketplaceNlSearchEnabled()) {
    return {
      ok: true,
      skipped: true,
      reason: "nl_disabled",
      appliedLabels: [],
      summary: "",
      refine: {},
    }
  }

  const parsed = await parseMarketplaceQuery(supabase, q)
  if (!marketplaceQueryLikelyNeedsLlm(q, parsed)) {
    return {
      ok: true,
      skipped: true,
      reason: "rules_sufficient",
      appliedLabels: [],
      summary: "",
      refine: {},
    }
  }

  const intent = await understandMarketplaceQueryWithLlm(q, parsed, { force: true })
  if (!intent) {
    return {
      ok: true,
      skipped: true,
      reason: "llm_unavailable",
      appliedLabels: [],
      summary: "",
      refine: {},
    }
  }

  const priceRules = extractPriceFiltersFromQuery(q)
  const lengthBounds = extractLengthBoundsFromQuery(q)
  const finSystemsList = [...intent.finSystems, ...extractFinSystemsFromQuery(q)]
  const finSetupsList = [...intent.finSetups, ...extractFinSetupsFromQuery(q)]
  const constructionsList = [
    ...intent.constructions,
    ...extractConstructionsFromQuery(q),
  ]
  const finSystems = uniqueCsv(finSystemsList)
  const finSetups = uniqueCsv(finSetupsList)
  const construction = uniqueCsv(constructionsList)
  const tailShapes = [
    ...(intent.tailShapes ?? []),
    ...extractTailShapesFromQuery(q),
  ]
  const stylesList = [...intent.styles, ...extractBoardStylesFromQuery(q)]

  const sanitizedPrices = sanitizeNlPriceAgainstQuery(q, {
    minPrice: intent.minPrice ?? priceRules.minPrice,
    maxPrice: intent.maxPrice ?? priceRules.maxPrice,
  })
  const minPrice = sanitizedPrices.minPrice
  const maxPrice = sanitizedPrices.maxPrice

  let brandId: string | undefined
  let brandModelId: string | undefined

  // Resolve catalog IDs only from LLM-extracted brand/model (never synonym/fuzzy rules parse).
  const llmBrand = intent.brandText?.trim() || ""
  const llmModel = intent.modelText?.trim() || ""
  if (llmBrand || llmModel) {
    const hintQ = [llmBrand, llmModel].filter(Boolean).join(" ").trim()
    if (hintQ.length >= 2) {
      const retry = await parseMarketplaceQuery(supabase, hintQ)
      if (
        retry.model &&
        catalogLabelGroundedInQuery(hintQ, retry.model.name) &&
        retry.modelIds.length === 1
      ) {
        brandModelId = retry.modelIds[0]
      } else if (retry.brand?.id && catalogLabelGroundedInQuery(hintQ, retry.brand.name)) {
        brandId = retry.brand.id
      }
    }
    if (!brandId && !brandModelId && llmBrand) {
      const brand = await resolveDirectoryBrandRowFromLabel(supabase, llmBrand)
      if (brand) brandId = brand.id
    }
  }

  const casualFeetLength = /\b\d{1,2}\s*(?:foot|feet|ft)\b/i.test(q)
  let dimLength: string | undefined
  let lengthInches: number | undefined
  if (intent.lengthToken?.trim()) {
    const inches = totalBoardLengthInchesFromCombinedInput(intent.lengthToken)
    lengthInches = inches ?? undefined
    dimLength =
      (inches != null ? formatBoardLengthTokenFromInches(inches) : null) ??
      intent.lengthToken.trim()
  } else if (parsed.lengthToken) {
    dimLength = parsed.lengthToken
    lengthInches = parsed.lengthInches ?? undefined
  }

  // Applied chips come from the LLM intent — not synonym/rules catalog accidents.
  const labels = nlIntentToAppliedLabels({
    ...intent,
    brandText: llmBrand || null,
    modelText: llmModel || null,
    finSystems: finSystemsList,
    finSetups: finSetupsList,
    constructions: constructionsList,
    tailShapes,
    styles: stylesList,
    minPrice,
    maxPrice,
  })
  if (
    lengthBounds.label &&
    !labels.some((l) => l.toLowerCase() === lengthBounds.label!.toLowerCase())
  ) {
    labels.push(lengthBounds.label)
  }
  if (
    dimLength &&
    !labels.some((l) => l.toLowerCase() === dimLength!.toLowerCase())
  ) {
    labels.push(dimLength)
  }

  const refine: MarketplaceNlHelperRefine = {}
  const clearParams: string[] = []

  if (brandModelId) refine.brandModelId = brandModelId
  else if (brandId) refine.brandId = brandId
  else {
    // Drop stale auto brand/model from a prior bad refine.
    clearParams.push("brandModelId", "brandId", "brand", "model")
  }

  if (minPrice != null) refine.minPrice = String(Math.round(minPrice))
  if (maxPrice != null) refine.maxPrice = String(Math.round(maxPrice))
  const condition = uniqueCsv(intent.conditions)
  if (condition) refine.condition = condition
  const style = uniqueCsv(stylesList)
  if (style) refine.style = style
  if (finSetups) refine.fin = finSetups
  if (finSystems) refine.finSystem = finSystems
  if (construction) refine.construction = construction
  if (intent.shippingAvailable === true) refine.shipping = "1"
  if (intent.locationText?.trim()) refine.location = intent.locationText.trim()

  // Map open length bounds onto browse length facet buckets when possible.
  if (lengthBounds.maxLengthInches != null || lengthBounds.minLengthInches != null) {
    const buckets = LENGTH_BUCKETS.filter((b) => {
      if (lengthBounds.maxLengthInches != null) {
        if (b.max == null || b.max > lengthBounds.maxLengthInches) return false
      }
      if (lengthBounds.minLengthInches != null) {
        if (b.min == null || b.min < lengthBounds.minLengthInches) return false
      }
      return true
    }).map((b) => b.value)
    if (buckets.length > 0) refine.length = buckets.join(",")
    clearParams.push("dimLength")
  } else if (casualFeetLength && lengthInches != null) {
    // "6 foot board" → 6'0–6'5 bucket (better recall than exact 72±1").
    const bucket = LENGTH_BUCKETS.find(
      (b) =>
        (b.min == null || lengthInches! >= b.min) &&
        (b.max == null || lengthInches! < b.max),
    )
    if (bucket) {
      refine.length = bucket.value
      clearParams.push("dimLength")
    } else if (dimLength) {
      refine.dimLength = dimLength
    }
  } else if (dimLength) {
    refine.dimLength = dimLength
  }

  // Clear a prior bad price refine (e.g. "under 6 feet" → maxPrice=6 in the URL).
  if (maxPrice == null && minPrice == null && (lengthBounds.label || /\b(?:feet|foot|ft)\b/i.test(q))) {
    clearParams.push("minPrice", "maxPrice")
  }

  if (clearParams.length > 0) {
    refine.clearParams = [...new Set(clearParams)]
  }

  return {
    ok: true,
    appliedLabels: labels,
    summary:
      [intent.summary.trim(), lengthBounds.label, dimLength].filter(Boolean).join(", ") ||
      labels.join(", "),
    refine,
  }
}
