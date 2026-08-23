/**
 * Parallel listing match: Elasticsearch recalls title + catalog candidates,
 * Gemini ranks/drops them and may suggest extra search phrases.
 */

import "server-only"

import { generateText, Output } from "ai"
import { gatewayTagsForFeature } from "@/lib/llm/app-models"
import {
  searchListingIdsFromElasticsearch,
  searchListingMatchCandidatesFromElasticsearch,
  type ListingMatchCandidate,
} from "@/lib/elasticsearch/listings-index"
import { searchQualityMemoryPromptBlock } from "@/lib/services/searchQuality"
import {
  marketplaceListingMatchSchema,
  type MarketplaceListingMatch,
} from "@/lib/validations/marketplaceListingMatch"
import { stripFilterLanguageFromKeyword } from "@/lib/services/searchBoards"
import { extractPriceFiltersFromQuery } from "@/lib/utils/marketplace-price-query"
import type { MarketplaceParsedQuery } from "@/lib/services/marketplaceQueryParse"
import type { MarketplaceNlSearchIntent } from "@/lib/validations/marketplaceNlSearch"

const CANDIDATE_LIMIT = 36
const EXTRA_PHRASE_LIMIT = 8

function nlSearchModelId(): string {
  return (
    process.env.MARKETPLACE_NL_SEARCH_MODEL?.trim() ||
    "google/gemini-2.5-flash"
  )
}

function formatCandidateLine(c: ListingMatchCandidate, index: number): string {
  const price = c.price != null ? `$${Math.round(c.price)}` : "no price"
  const length =
    c.lengthInches != null ? `${Math.floor(c.lengthInches / 12)}'${Math.round(c.lengthInches % 12)}` : ""
  const bits = [c.title, c.brand, c.model, c.boardType, length, price].filter(Boolean)
  return `${index + 1}. ${c.id} — ${bits.join(" · ")}`
}

function allowedIdSet(candidates: ListingMatchCandidate[]): Set<string> {
  return new Set(candidates.map((c) => c.id))
}

export type MarketplaceListingMatchResult = {
  rankedIds: string[]
  dropIds: string[]
  extraPhrases: string[]
  extraIds: string[]
  summary: string
}

export function listingMatchSearchOptions(
  rawQuery: string,
  parsed: MarketplaceParsedQuery,
  intent: MarketplaceNlSearchIntent | null,
): {
  keyword: string
  boostBrandModelIds: string[] | null
  boostBrandId: string | null
  minPrice: number | null
  maxPrice: number | null
  lengthInches: number | null
  boardTypes: string[] | null
  expansions: string[]
} {
  const priceRules = extractPriceFiltersFromQuery(rawQuery)
  const minPrice = intent?.minPrice ?? priceRules.minPrice ?? null
  const maxPrice = intent?.maxPrice ?? priceRules.maxPrice ?? null
  const keyword =
    stripFilterLanguageFromKeyword(rawQuery) ||
    (intent?.residualText?.trim() || "") ||
    (parsed.model?.name ?? parsed.brand?.name ?? rawQuery.trim())
  const boostBrandModelIds =
    parsed.modelIds.length > 0 ? parsed.modelIds : parsed.model?.id ? [parsed.model.id] : null
  const boostBrandId = boostBrandModelIds?.length ? null : parsed.brand?.id ?? null
  const styles = intent?.styles?.length ? intent.styles : parsed.styleIntent
  return {
    keyword,
    boostBrandModelIds,
    boostBrandId,
    minPrice,
    maxPrice,
    lengthInches: parsed.lengthInches,
    boardTypes: styles.length > 0 ? styles : null,
    expansions: parsed.expansions ?? [],
  }
}

async function callGeminiForListingMatch(
  rawQuery: string,
  candidates: ListingMatchCandidate[],
  memoryBlock: string,
): Promise<MarketplaceListingMatch | null> {
  if (candidates.length === 0) return null
  const lines = candidates.map((c, i) => formatCandidateLine(c, i)).join("\n")
  try {
    const { output } = await generateText({
      model: nlSearchModelId(),
      output: Output.object({ schema: marketplaceListingMatchSchema }),
      system: `You match a surfboard marketplace search to candidate listings.
Candidates were recalled from Elasticsearch using title, brand, model, and catalog ids.
Rules:
- Only use listing ids from the candidate list. Never invent ids.
- Keep a listing if the title, brand, or model reasonably matches the shopper's intent (including unlinked catalog names in the title).
- Drop listings that conflict with hard constraints in the query (wrong brand/model, over a stated max price, wrong length when the query named a length).
- Rank remaining matches best-first. Catalog-linked and exact title matches first, then close title matches, then related models only if the query was generic.
- extraPhrases: nicknames or model variants to search if the list is missing obvious matches. Do not repeat the original query.
Prices are USD.${memoryBlock}`,
      prompt: `Query:\n"""${rawQuery.trim()}"""\n\nCandidates:\n${lines}\n\nRank and drop from this list only.`,
      temperature: 0,
      providerOptions: {
        gateway: {
          tags: gatewayTagsForFeature("marketplace_nl_search"),
        },
      },
    })
    if (!output) return null
    return marketplaceListingMatchSchema.parse(output)
  } catch (err) {
    console.error("[marketplaceListingMatch] Gemini match failed:", err)
    return null
  }
}

/**
 * Rank ES title+catalog candidates with Gemini and optionally recall extra phrases.
 */
export async function matchMarketplaceListingsWithLlm(
  rawQuery: string,
  parsed: MarketplaceParsedQuery,
  intent: MarketplaceNlSearchIntent | null,
  sections: string[],
): Promise<MarketplaceListingMatchResult> {
  const empty: MarketplaceListingMatchResult = {
    rankedIds: [],
    dropIds: [],
    extraPhrases: [],
    extraIds: [],
    summary: "",
  }
  const q = rawQuery.trim()
  if (q.length < 2) return empty

  const opts = listingMatchSearchOptions(q, parsed, intent)
  const candidates = await searchListingMatchCandidatesFromElasticsearch(
    opts.keyword,
    CANDIDATE_LIMIT,
    {
      sections,
      expansions: opts.expansions,
      boostBrandModelIds: opts.boostBrandModelIds,
      boostBrandId: opts.boostBrandId,
      minPrice: opts.minPrice,
      maxPrice: opts.maxPrice,
      lengthInches: opts.lengthInches,
      boardTypes: opts.boardTypes,
    },
  )

  const memoryBlock = await searchQualityMemoryPromptBlock(q)
  const match = await callGeminiForListingMatch(q, candidates, memoryBlock)
  const allowed = allowedIdSet(candidates)
  const rankedIds = (match?.rankedIds ?? []).filter((id) => allowed.has(id))
  const dropIds = (match?.dropIds ?? []).filter((id) => allowed.has(id) && !rankedIds.includes(id))
  const extraPhrases = (match?.extraPhrases ?? [])
    .map((p) => p.trim())
    .filter((p) => p.length >= 3 && p.toLowerCase() !== q.toLowerCase())
    .slice(0, 6)

  const extraIds: string[] = []
  const seen = new Set([...rankedIds, ...candidates.map((c) => c.id)])
  for (const phrase of extraPhrases) {
    if (extraIds.length >= EXTRA_PHRASE_LIMIT) break
    const ids = await searchListingIdsFromElasticsearch(phrase, 8, {
      sections,
      expansions: opts.expansions,
      boostBrandModelIds: opts.boostBrandModelIds,
      boostBrandId: opts.boostBrandId,
      minPrice: opts.minPrice,
      maxPrice: opts.maxPrice,
      boardTypes: opts.boardTypes,
    })
    for (const id of ids) {
      if (seen.has(id)) continue
      seen.add(id)
      extraIds.push(id)
      if (extraIds.length >= EXTRA_PHRASE_LIMIT) break
    }
  }

  return {
    rankedIds,
    dropIds,
    extraPhrases,
    extraIds,
    summary: match?.summary?.trim() ?? "",
  }
}
