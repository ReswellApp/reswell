/**
 * Boards search orchestration: parse free-text → structured filters + expansions,
 * then map onto the Elasticsearch `/boards` browse query context.
 *
 * Critical path is rules-only (brand/model/length/price/fins/tails) so Enter stays
 * fast. Gemini via AI Gateway runs in parallel as a client helper
 * (`/api/search/nl-helper`) and may refine filters after first paint.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { BoardsBrowseEsContext } from "@/lib/elasticsearch/boards-browse-search"
import type { BoardsBrowseFacetSelections } from "@/lib/boards-browse-facets"
import { totalBoardLengthInchesFromCombinedInput } from "@/lib/board-measurements"
import {
  formatBoardLengthTokenFromInches,
  parseMarketplaceQuery,
  type MarketplaceParsedQuery,
} from "@/lib/services/marketplaceQueryParse"
import {
  nlIntentToAppliedLabels,
  rulesFinOverlayFromQuery,
} from "@/lib/services/marketplaceQueryUnderstand"
import { stripMarketplaceSearchNoiseWords } from "@/lib/utils/marketplace-brand-query"
import { stripConstructionFilterPhrasesFromKeyword } from "@/lib/utils/marketplace-construction-query"
import { stripFinFilterPhrasesFromKeyword } from "@/lib/utils/marketplace-fin-query"
import { extractPriceFiltersFromQuery } from "@/lib/utils/marketplace-price-query"
import { extractLengthBoundsFromQuery } from "@/lib/utils/marketplace-length-query"
import { stripTailFilterPhrasesFromKeyword } from "@/lib/utils/marketplace-tail-query"
import { resolveDirectoryBrandRowFromLabel } from "@/lib/services/brandDirectorySearch"
import type { MarketplaceNlSearchIntent } from "@/lib/validations/marketplaceNlSearch"

/** Words that belong in filters, not ES keyword `must` clauses. */
const FILTER_LANGUAGE_TOKENS = new Set([
  "under",
  "over",
  "below",
  "above",
  "less",
  "more",
  "than",
  "between",
  "max",
  "min",
  "budget",
  "cheap",
  "around",
  "about",
  "near",
  "within",
  "miles",
  "mi",
  "shipping",
  "ship",
  "ships",
  "pickup",
  "available",
  "dollars",
  "usd",
  "price",
  "priced",
  "with",
  "without",
  "fins",
  "fin",
  "tail",
  "tails",
  "feet",
  "foot",
  "ft",
  "inches",
  "inch",
])

function stripFilterLanguageFromKeyword(raw: string): string {
  const withoutMoney = raw.replace(/\$\s*\d+(?:[.,]\d+)?/g, " ").replace(/\b\d+\s*(?:dollars|usd)\b/gi, " ")
  const tokens = stripMarketplaceSearchNoiseWords(withoutMoney)
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => {
      const core = t.toLowerCase().replace(/^['']+|['']+$/g, "")
      if (!core) return false
      if (FILTER_LANGUAGE_TOKENS.has(core)) return false
      if (/^\d+$/.test(core)) return false
      return true
    })
  return tokens.join(" ").trim()
}

export type SearchBoardsNlOverlay = {
  styles: string[]
  conditions: string[]
  constructions: string[]
  finSystems: string[]
  finSetups: string[]
  tailShapes: string[]
  minPrice?: number
  maxPrice?: number
  locationText?: string
  shippingAvailable?: boolean
  lengthInches?: number
  lengthToken?: string
  minLengthInches?: number
  maxLengthInches?: number
  /** Keyword override from LLM residual (merged carefully with rules text). */
  residualText?: string
  brandText?: string
  modelText?: string
  appliedLabels: string[]
  summary: string
}

export type SearchBoardsQueryResolution = {
  parsed: MarketplaceParsedQuery
  nl: SearchBoardsNlOverlay | null
  /** Context fields to merge into boards browse ES (URL filters win when already set). */
  context: Pick<
    BoardsBrowseEsContext,
    | "query"
    | "rankQuery"
    | "brand"
    | "model"
    | "brandId"
    | "brandModelId"
    | "brandModelIds"
    | "expansions"
    | "lengthInches"
    | "minLengthInches"
    | "maxLengthInches"
    | "tailShapes"
  >
}

function nlIntentToOverlay(intent: MarketplaceNlSearchIntent): SearchBoardsNlOverlay {
  let lengthInches: number | undefined
  let lengthToken = intent.lengthToken?.trim() || undefined
  if (lengthToken) {
    const inches = totalBoardLengthInchesFromCombinedInput(lengthToken)
    if (inches != null) {
      lengthInches = inches
      lengthToken = formatBoardLengthTokenFromInches(inches) ?? lengthToken
    }
  }

  return {
    styles: intent.styles,
    conditions: intent.conditions,
    constructions: intent.constructions,
    finSystems: intent.finSystems,
    finSetups: intent.finSetups,
    tailShapes: intent.tailShapes ?? [],
    minPrice: intent.minPrice ?? undefined,
    maxPrice: intent.maxPrice ?? undefined,
    locationText: intent.locationText?.trim() || undefined,
    shippingAvailable: intent.shippingAvailable === true ? true : undefined,
    lengthInches,
    lengthToken,
    residualText: stripConstructionFilterPhrasesFromKeyword(
      stripTailFilterPhrasesFromKeyword(
        stripFinFilterPhrasesFromKeyword(intent.residualText?.trim() || ""),
      ),
    ),
    brandText: intent.brandText?.trim() || undefined,
    modelText: intent.modelText?.trim() || undefined,
    appliedLabels: nlIntentToAppliedLabels(intent),
    summary: intent.summary.trim(),
  }
}

/** Merge NL facet hints into URL facet selections (URL wins when already set). */
export function mergeNlOverlayIntoFacets(
  facets: BoardsBrowseFacetSelections,
  nl: SearchBoardsNlOverlay | null,
): BoardsBrowseFacetSelections {
  if (!nl) return facets
  return {
    styles: facets.styles.length > 0 ? facets.styles : nl.styles,
    conditions: facets.conditions.length > 0 ? facets.conditions : nl.conditions,
    finSetups: facets.finSetups.length > 0 ? facets.finSetups : nl.finSetups,
    finSystems: facets.finSystems.length > 0 ? facets.finSystems : nl.finSystems,
    constructions: facets.constructions.length > 0 ? facets.constructions : nl.constructions,
    lengthBuckets: facets.lengthBuckets,
    volumeBuckets: facets.volumeBuckets,
  }
}

/**
 * Resolve a boards keyword query into ES-ready filters.
 * Explicit URL `brandId` / `brandModelId` take precedence over parsed values.
 */
export async function resolveBoardsSearchQuery(
  supabase: SupabaseClient,
  input: {
    q: string
    brandId?: string
    brandModelId?: string
    brand?: string
    model?: string
  },
): Promise<SearchBoardsQueryResolution> {
  const q = (input.q || "").trim()
  const parsed = q.length >= 2
    ? await parseMarketplaceQuery(supabase, q)
    : {
        raw: q,
        cleaned: q,
        brand: null,
        model: null,
        modelIds: [],
        lengthInches: null,
        lengthToken: null,
        residualText: "",
        textQuery: q,
        isBrandOnly: false,
        expansions: [],
      }

  // Rules-only on the request critical path (price / fins / tails / length bounds).
  // Gemini runs in parallel via `/api/search/nl-helper` and must not delay first results.
  const finRules = q.length >= 2 ? rulesFinOverlayFromQuery(q) : null
  const priceRules = q.length >= 2 ? extractPriceFiltersFromQuery(q) : {}
  const lengthBounds = q.length >= 2 ? extractLengthBoundsFromQuery(q) : {}
  const lengthBoundLabel = lengthBounds.label ?? null
  const hasLengthBounds =
    lengthBounds.minLengthInches != null || lengthBounds.maxLengthInches != null
  const hasPriceRules = priceRules.minPrice != null || priceRules.maxPrice != null

  const mergedNlIntent: MarketplaceNlSearchIntent | null = finRules
    ? {
        ...finRules,
        brandText: finRules.brandText ?? parsed.brand?.name ?? null,
        modelText: finRules.modelText ?? parsed.model?.name ?? null,
        minPrice: priceRules.minPrice ?? null,
        maxPrice: priceRules.maxPrice ?? null,
        summary:
          [
            parsed.brand?.name,
            finRules.summary,
            lengthBoundLabel,
            priceRules.maxPrice != null ? `under $${priceRules.maxPrice}` : null,
            priceRules.minPrice != null ? `from $${priceRules.minPrice}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || finRules.summary,
      }
    : hasPriceRules || hasLengthBounds
      ? {
          brandText: parsed.brand?.name ?? null,
          modelText: parsed.model?.name ?? null,
          residualText: parsed.residualText || "",
          styles: [],
          conditions: [],
          constructions: [],
          finSystems: [],
          finSetups: [],
          tailShapes: [],
          lengthToken: parsed.lengthToken,
          minPrice: priceRules.minPrice ?? null,
          maxPrice: priceRules.maxPrice ?? null,
          locationText: null,
          shippingAvailable: null,
          summary: [
            parsed.brand?.name,
            lengthBoundLabel,
            priceRules.maxPrice != null ? `under $${priceRules.maxPrice}` : null,
            priceRules.minPrice != null ? `from $${priceRules.minPrice}` : null,
          ]
            .filter(Boolean)
            .join(", "),
        }
      : parsed.brand || parsed.model || parsed.lengthInches != null
        ? {
            brandText: parsed.brand?.name ?? null,
            modelText: parsed.model?.name ?? null,
            residualText: parsed.residualText || "",
            styles: [],
            conditions: [],
            constructions: [],
            finSystems: [],
            finSetups: [],
            tailShapes: [],
            lengthToken: parsed.lengthToken,
            minPrice: null,
            maxPrice: null,
            locationText: null,
            shippingAvailable: null,
            summary: [parsed.brand?.name, parsed.model?.name, parsed.lengthToken]
              .filter(Boolean)
              .join(", "),
          }
        : null
  let nl = mergedNlIntent ? nlIntentToOverlay(mergedNlIntent) : null
  if (nl && hasLengthBounds) {
    const labels = [...nl.appliedLabels]
    if (lengthBoundLabel && !labels.some((l) => l.toLowerCase() === lengthBoundLabel.toLowerCase())) {
      labels.push(lengthBoundLabel)
    }
    nl = {
      ...nl,
      minLengthInches: lengthBounds.minLengthInches,
      maxLengthInches: lengthBounds.maxLengthInches,
      appliedLabels: labels,
      summary: nl.summary.includes(lengthBoundLabel ?? "\0")
        ? nl.summary
        : [nl.summary, lengthBoundLabel].filter(Boolean).join(", "),
    }
  }

  let enriched = parsed
  // Rules brandText is usually already on `parsed`; keep resolve for safety.
  if (!enriched.brand && nl?.brandText) {
    const fromRules = await resolveDirectoryBrandRowFromLabel(supabase, nl.brandText)
    if (fromRules) {
      enriched = {
        ...enriched,
        brand: { id: fromRules.id, name: fromRules.name, slug: fromRules.slug },
      }
    }
  }

  if (nl?.lengthInches != null && enriched.lengthInches == null) {
    enriched = {
      ...enriched,
      lengthInches: nl.lengthInches,
      lengthToken: nl.lengthToken ?? enriched.lengthToken,
    }
  }

  const urlBrandModelId = input.brandModelId?.trim() || undefined
  const urlBrandId = input.brandId?.trim() || undefined
  const urlBrand = input.brand?.trim() || undefined
  const urlModel = input.model?.trim() || undefined

  const brandModelIds =
    urlBrandModelId
      ? [urlBrandModelId]
      : enriched.modelIds.length > 0
        ? enriched.modelIds
        : enriched.model?.id
          ? [enriched.model.id]
          : undefined

  const brandModelId = brandModelIds?.length === 1 ? brandModelIds[0] : undefined
  const brandId =
    brandModelIds && brandModelIds.length > 0
      ? undefined
      : urlBrandId || enriched.brand?.id || undefined
  const brand =
    brandModelIds?.length || brandId
      ? undefined
      : urlBrand ||
        (enriched.brand && !enriched.model ? enriched.brand.name : undefined) ||
        nl?.brandText
  const model =
    brandModelIds?.length || brandId
      ? undefined
      : urlModel || enriched.model?.name || nl?.modelText

  // When NL (or rules) already applied brand/price/etc., leftover text must NOT be an ES
  // `must` (filter words like "under" zero results via minimum_should_match). Instead it
  // becomes a soft `rankQuery` boost so model words still improve ordering.
  const structuredFiltersApplied = Boolean(
    brandId ||
      brandModelIds?.length ||
      brand ||
      model ||
      enriched.lengthInches != null ||
      nl?.minLengthInches != null ||
      nl?.maxLengthInches != null ||
      nl?.maxPrice != null ||
      nl?.minPrice != null ||
      nl?.conditions.length ||
      nl?.styles.length ||
      nl?.finSystems.length ||
      nl?.finSetups.length ||
      nl?.tailShapes.length ||
      nl?.constructions.length ||
      nl?.shippingAvailable ||
      nl?.locationText,
  )

  const residualKeyword = nl
    ? stripFilterLanguageFromKeyword(
        stripConstructionFilterPhrasesFromKeyword(
          stripTailFilterPhrasesFromKeyword(
            stripFinFilterPhrasesFromKeyword(nl.residualText || ""),
          ),
        ),
      ) ||
      // Model text is already a hard filter when resolved; only keep as soft rank otherwise.
      (!brandModelIds?.length
        ? stripFilterLanguageFromKeyword(nl.modelText || "")
        : "") ||
      ""
    : stripFilterLanguageFromKeyword(
        stripConstructionFilterPhrasesFromKeyword(
          stripTailFilterPhrasesFromKeyword(
            stripFinFilterPhrasesFromKeyword(enriched.textQuery || q),
          ),
        ),
      ) || ""

  let query: string | undefined
  let rankQuery: string | undefined

  if (structuredFiltersApplied) {
    // Filters own recall; residual only ranks (e.g. "puddle jumper" within Lost + $800).
    query = undefined
    rankQuery = residualKeyword || undefined
    if (rankQuery) {
      const qLower = rankQuery.toLowerCase()
      const brandName = (enriched.brand?.name || brand || nl?.brandText || "").toLowerCase()
      if (
        brandName &&
        (qLower === brandName ||
          brandName.includes(qLower) ||
          qLower.includes(brandName.split(/\s+/)[0] ?? ""))
      ) {
        rankQuery = undefined
      }
    }
  } else {
    query = residualKeyword || undefined
  }

  return {
    parsed: enriched,
    nl,
    context: {
      query,
      rankQuery,
      brand,
      model,
      brandId,
      brandModelId,
      brandModelIds,
      expansions: enriched.expansions,
      lengthInches: enriched.lengthInches ?? nl?.lengthInches ?? undefined,
      minLengthInches: nl?.minLengthInches,
      maxLengthInches: nl?.maxLengthInches,
      tailShapes: nl?.tailShapes.length ? nl.tailShapes : undefined,
    },
  }
}

/** Build a `/boards` href from a free-text query (nav submit / NL search landing). */
export function boardsSearchHrefFromQuery(
  rawQuery: string,
  options?: {
    brandModelId?: string | null
    brandId?: string | null
    lengthToken?: string | null
    navSubmitted?: boolean
  },
): string {
  const params = new URLSearchParams()
  const q = rawQuery.trim()
  if (q) params.set("q", q)
  if (options?.navSubmitted) params.set("nq", "1")
  if (options?.brandModelId) params.set("brandModelId", options.brandModelId)
  else if (options?.brandId) params.set("brandId", options.brandId)
  if (options?.lengthToken) params.set("dimLength", options.lengthToken)
  const qs = params.toString()
  return qs ? `/boards?${qs}` : "/boards"
}
