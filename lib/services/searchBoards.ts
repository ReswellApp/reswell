/**
 * Boards search orchestration: parse free-text → structured filters + expansions,
 * then map onto the Elasticsearch `/boards` browse query context.
 *
 * Optional Gemini NL understanding fills condition / price / location / style when
 * the query looks like natural language. ES DSL stays in boards-browse-search.
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
  understandMarketplaceQueryWithLlm,
} from "@/lib/services/marketplaceQueryUnderstand"
import type { MarketplaceNlSearchIntent } from "@/lib/validations/marketplaceNlSearch"

export type SearchBoardsNlOverlay = {
  styles: string[]
  conditions: string[]
  constructions: string[]
  finSystems: string[]
  minPrice?: number
  maxPrice?: number
  locationText?: string
  shippingAvailable?: boolean
  lengthInches?: number
  lengthToken?: string
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
    | "brand"
    | "model"
    | "brandId"
    | "brandModelId"
    | "brandModelIds"
    | "expansions"
    | "lengthInches"
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
    minPrice: intent.minPrice ?? undefined,
    maxPrice: intent.maxPrice ?? undefined,
    locationText: intent.locationText?.trim() || undefined,
    shippingAvailable: intent.shippingAvailable === true ? true : undefined,
    lengthInches,
    lengthToken,
    residualText: intent.residualText?.trim() || undefined,
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
    finSetups: facets.finSetups,
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

  const nlIntent =
    q.length >= 2 ? await understandMarketplaceQueryWithLlm(q, parsed) : null
  const nl = nlIntent ? nlIntentToOverlay(nlIntent) : null

  // If rules missed brand/model but Gemini found text, re-parse with that hint text.
  let enriched = parsed
  if (nl && (!parsed.model || parsed.modelIds.length === 0)) {
    const hintQ = [nl.brandText, nl.modelText, nl.lengthToken].filter(Boolean).join(" ").trim()
    if (hintQ.length >= 2 && hintQ.toLowerCase() !== q.toLowerCase()) {
      const retry = await parseMarketplaceQuery(supabase, `${hintQ} ${nl.residualText ?? ""}`.trim())
      if (retry.modelIds.length > 0 || retry.brand) {
        enriched = {
          ...parsed,
          brand: parsed.brand ?? retry.brand,
          model: parsed.model ?? retry.model,
          modelIds: parsed.modelIds.length > 0 ? parsed.modelIds : retry.modelIds,
          lengthInches: parsed.lengthInches ?? retry.lengthInches ?? nl.lengthInches ?? null,
          lengthToken: parsed.lengthToken ?? retry.lengthToken ?? nl.lengthToken ?? null,
          textQuery:
            parsed.textQuery ||
            nl.residualText ||
            retry.textQuery ||
            parsed.cleaned ||
            q,
        }
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

  const query =
    enriched.textQuery.trim() ||
    nl?.residualText ||
    nl?.modelText ||
    q ||
    undefined

  return {
    parsed: enriched,
    nl,
    context: {
      query,
      brand,
      model,
      brandId,
      brandModelId,
      brandModelIds,
      expansions: enriched.expansions,
      lengthInches: enriched.lengthInches ?? nl?.lengthInches ?? undefined,
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
