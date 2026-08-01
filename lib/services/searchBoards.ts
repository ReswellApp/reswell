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
  rulesFinOverlayFromQuery,
  understandMarketplaceQueryWithLlm,
} from "@/lib/services/marketplaceQueryUnderstand"
import { stripMarketplaceSearchNoiseWords } from "@/lib/utils/marketplace-brand-query"
import { stripFinFilterPhrasesFromKeyword } from "@/lib/utils/marketplace-fin-query"
import { extractPriceFiltersFromQuery } from "@/lib/utils/marketplace-price-query"
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
])

function uniqueKeepOrder(values: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of values) {
    if (!v || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

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
    | "rankQuery"
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
    finSetups: intent.finSetups,
    minPrice: intent.minPrice ?? undefined,
    maxPrice: intent.maxPrice ?? undefined,
    locationText: intent.locationText?.trim() || undefined,
    shippingAvailable: intent.shippingAvailable === true ? true : undefined,
    lengthInches,
    lengthToken,
    residualText: stripFinFilterPhrasesFromKeyword(intent.residualText?.trim() || ""),
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

  const nlIntent =
    q.length >= 2 ? await understandMarketplaceQueryWithLlm(q, parsed) : null
  // Always apply deterministic fin + price aliases; fall back to rules-only when Gemini skipped.
  const finRules = q.length >= 2 ? rulesFinOverlayFromQuery(q) : null
  const priceRules = q.length >= 2 ? extractPriceFiltersFromQuery(q) : {}
  const mergedNlIntent: MarketplaceNlSearchIntent | null = nlIntent
    ? {
        ...nlIntent,
        finSystems: uniqueKeepOrder([
          ...nlIntent.finSystems,
          ...(finRules?.finSystems ?? []),
        ]),
        finSetups: uniqueKeepOrder([
          ...nlIntent.finSetups,
          ...(finRules?.finSetups ?? []),
        ]),
        minPrice: nlIntent.minPrice ?? priceRules.minPrice ?? null,
        maxPrice: nlIntent.maxPrice ?? priceRules.maxPrice ?? null,
      }
    : finRules
      ? {
          ...finRules,
          minPrice: priceRules.minPrice ?? null,
          maxPrice: priceRules.maxPrice ?? null,
          summary:
            [
              finRules.summary,
              priceRules.maxPrice != null ? `under $${priceRules.maxPrice}` : null,
              priceRules.minPrice != null ? `from $${priceRules.minPrice}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || finRules.summary,
        }
      : priceRules.minPrice != null || priceRules.maxPrice != null
        ? {
            brandText: parsed.brand?.name ?? null,
            modelText: parsed.model?.name ?? null,
            residualText: parsed.residualText || "",
            styles: [],
            conditions: [],
            constructions: [],
            finSystems: [],
            finSetups: [],
            lengthToken: parsed.lengthToken,
            minPrice: priceRules.minPrice ?? null,
            maxPrice: priceRules.maxPrice ?? null,
            locationText: null,
            shippingAvailable: null,
            summary: [
              parsed.brand?.name,
              priceRules.maxPrice != null ? `under $${priceRules.maxPrice}` : null,
              priceRules.minPrice != null ? `from $${priceRules.minPrice}` : null,
            ]
              .filter(Boolean)
              .join(", "),
          }
        : null
  const nl = mergedNlIntent ? nlIntentToOverlay(mergedNlIntent) : null

  // If rules missed brand/model but Gemini found text, re-parse with that hint text.
  let enriched = parsed
  if (nl && (!parsed.brand || !parsed.model || parsed.modelIds.length === 0)) {
    const hintQ = [nl.brandText, nl.modelText, nl.lengthToken].filter(Boolean).join(" ").trim()
    if (hintQ.length >= 2) {
      const retry = await parseMarketplaceQuery(supabase, `${hintQ} ${nl.residualText ?? ""}`.trim())
      if (retry.modelIds.length > 0 || retry.brand) {
        enriched = {
          ...parsed,
          brand: parsed.brand ?? retry.brand,
          model: parsed.model ?? retry.model,
          modelIds: parsed.modelIds.length > 0 ? parsed.modelIds : retry.modelIds,
          lengthInches: parsed.lengthInches ?? retry.lengthInches ?? nl.lengthInches ?? null,
          lengthToken: parsed.lengthToken ?? retry.lengthToken ?? nl.lengthToken ?? null,
          // Prefer NL residual for keywords — never keep "under $800" in textQuery.
          textQuery: nl.residualText || retry.residualText || "",
        }
      }
    }
    // Resolve bare NL brandText (e.g. "Lost") to directory brand when rules missed it.
    if (!enriched.brand && nl.brandText) {
      const fromNl = await resolveDirectoryBrandRowFromLabel(supabase, nl.brandText)
      if (fromNl) {
        enriched = {
          ...enriched,
          brand: { id: fromNl.id, name: fromNl.name, slug: fromNl.slug },
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

  // When NL (or rules) already applied brand/price/etc., leftover text must NOT be an ES
  // `must` (filter words like "under" zero results via minimum_should_match). Instead it
  // becomes a soft `rankQuery` boost so model words still improve ordering.
  const structuredFiltersApplied = Boolean(
    brandId ||
      brandModelIds?.length ||
      brand ||
      model ||
      enriched.lengthInches != null ||
      nl?.maxPrice != null ||
      nl?.minPrice != null ||
      nl?.conditions.length ||
      nl?.styles.length ||
      nl?.finSystems.length ||
      nl?.finSetups.length ||
      nl?.constructions.length ||
      nl?.shippingAvailable ||
      nl?.locationText,
  )

  const residualKeyword = nl
    ? stripFilterLanguageFromKeyword(
        stripFinFilterPhrasesFromKeyword(nl.residualText || ""),
      ) ||
      // Model text is already a hard filter when resolved; only keep as soft rank otherwise.
      (!brandModelIds?.length
        ? stripFilterLanguageFromKeyword(nl.modelText || "")
        : "") ||
      ""
    : stripFilterLanguageFromKeyword(
        stripFinFilterPhrasesFromKeyword(enriched.textQuery || q),
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
