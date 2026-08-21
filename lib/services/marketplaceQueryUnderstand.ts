/**
 * Natural-language marketplace query understanding via Gemini (AI Gateway).
 *
 * Role: compile free-text into structured `/boards` filters. Retrieval stays
 * Elasticsearch — the LLM does not scan listing rows.
 */

import { unstable_cache } from "next/cache"
import { generateText, Output } from "ai"
import { gatewayTagsForFeature } from "@/lib/llm/app-models"
import {
  marketplaceNlSearchIntentSchema,
  type MarketplaceNlSearchIntent,
} from "@/lib/validations/marketplaceNlSearch"
import type { MarketplaceParsedQuery } from "@/lib/services/marketplaceQueryParse"
import { isMarketplaceSearchNoiseToken } from "@/lib/utils/marketplace-brand-query"
import { compactSearchCurationKey } from "@/lib/validations/searchCuration"
import {
  constructionLabel,
  extractConstructionsFromQuery,
  queryMentionsConstructionFilters,
} from "@/lib/utils/marketplace-construction-query"
import {
  extractFinSetupsFromQuery,
  extractFinSystemsFromQuery,
  finSetupLabel,
  finSystemLabel,
  queryMentionsFinFilters,
} from "@/lib/utils/marketplace-fin-query"
import {
  extractTailShapesFromQuery,
  queryMentionsTailFilters,
  tailShapeLabel,
} from "@/lib/utils/marketplace-tail-query"

export const MARKETPLACE_NL_SEARCH_CACHE_TAG = "marketplace-nl-search"
const NL_CACHE_SECONDS = 60 * 30
const MAX_SYNONYM_HINTS = 12

/** Default: Gemini Flash via Vercel AI Gateway (`AI_GATEWAY_API_KEY` or OIDC). */
function nlSearchModelId(): string {
  return (
    process.env.MARKETPLACE_NL_SEARCH_MODEL?.trim() ||
    "google/gemini-2.5-flash"
  )
}

export function isMarketplaceNlSearchEnabled(): boolean {
  if (process.env.MARKETPLACE_NL_SEARCH_ENABLED === "false") return false
  // Gateway key, Vercel OIDC, or explicit enable.
  return (
    process.env.MARKETPLACE_NL_SEARCH_ENABLED === "true" ||
    Boolean(process.env.AI_GATEWAY_API_KEY?.trim()) ||
    Boolean(process.env.VERCEL_OIDC_TOKEN?.trim())
  )
}

/** Heuristic: call the LLM when the query looks like natural language / filters. */
export function marketplaceQueryLikelyNeedsLlm(
  rawQuery: string,
  rulesParsed: MarketplaceParsedQuery,
): boolean {
  const q = rawQuery.trim()
  if (q.length < 6) return false

  const lower = q.toLowerCase()
  const nlSignals =
    /\b(under|over|less than|more than|near|around|within|shipping|ship|pickup|pick up|excellent|very good|brand new|like new|good condition|fair|budget|cheap|max|min|between|with|without|available)\b/.test(
      lower,
    ) ||
    /\$\s*\d+/.test(q) ||
    /\b\d{2,5}\s*(dollars|usd)\b/.test(lower) ||
    // Casual length language — LLM should own Applied chips (not fuzzy catalog matches).
    /\b\d{1,2}\s*(?:foot|feet|ft)\b/.test(lower) ||
    /\b\d{1,2}'\s*\d{0,2}\b/.test(lower) ||
    queryMentionsFinFilters(q) ||
    queryMentionsTailFilters(q) ||
    queryMentionsConstructionFilters(q)

  if (nlSignals) return true

  const tokens = lower.match(/[\w']+/g) ?? []
  const hasModel = Boolean(rulesParsed.model || rulesParsed.modelIds.length > 0)

  // Multi-token queries with no structured brand/model hit still benefit from NL.
  if (tokens.length >= 3 && !hasModel) return true

  // Curated synonym/typo recovery — expansions matched but the typed query isn't already
  // the canonical catalog name (skip "channel islands"; keep "ci 6 foot" / "chanel islands").
  if (
    tokens.length >= 2 &&
    (rulesParsed.expansions?.length ?? 0) > 0 &&
    !hasModel &&
    !queryMatchesCanonicalExpansion(q, rulesParsed.expansions)
  ) {
    return true
  }

  // Two-token proper-name-looking queries with no catalog hit (e.g. "dumpstr diver").
  if (!hasModel && !rulesParsed.brand && looksLikeCatalogNameQuery(tokens)) {
    return true
  }

  return false
}

/** Distinctive 2–4 token phrases that look like a mistyped brand/model, not filter chatter. */
function looksLikeCatalogNameQuery(tokens: string[]): boolean {
  if (tokens.length < 2 || tokens.length > 4) return false
  const meaningful = tokens.filter((t) => t.length >= 4 && !isMarketplaceSearchNoiseToken(t))
  return meaningful.length >= 2
}

function queryMatchesCanonicalExpansion(rawQuery: string, expansions: string[]): boolean {
  const q = compactSearchCurationKey(rawQuery)
  if (q.length < 4) return false
  return expansions.some((expansion) => compactSearchCurationKey(expansion) === q)
}

function synonymHintBlock(expansions: string[]): string {
  if (expansions.length === 0) return ""
  const lines = expansions.map((e) => `- ${e}`).join("\n")
  return `
Known catalog names for this query (from search synonyms). If the user mistyped or used a nickname, set brandText/modelText to these canonical names. Do not invent names that are not in this list or clearly named in the query:
${lines}`
}

async function callGeminiForNlIntent(
  rawQuery: string,
  synonymExpansions: string[],
): Promise<MarketplaceNlSearchIntent | null> {
  const q = rawQuery.trim()
  if (q.length < 2) return null

  try {
    const { output } = await generateText({
      model: nlSearchModelId(),
      output: Output.object({ schema: marketplaceNlSearchIntentSchema }),
      system: `You extract surfboard marketplace search filters for Reswell.
Only use the provided enum values for styles, conditions, constructions, finSystems, finSetups, and tailShapes.
Map casual language:
- "new" / "brand new" → brand_new; "mint" / "like new" → excellent
- "CI" → brandText "Channel Islands"; "Lost" / "Mayhem" → brandText "Lost Surfboards"
- Length: "6 foot" / "6 feet" / "6ft" / "6'" → lengthToken "6'0"; "5'10" stays "5'10"
- Fin SYSTEMS (plugs): "fcs" / "fcs2" / "fcs ii" → fcs_ii; "futures" → futures; "twin tab" → fcs_twin_tab; "glass on" → glass_on
- Fin SETUPS (layout): "thruster" / "tri" → thruster; "twin" → twin_only; "2+1" → twin; "quad" → quad; "5-fin" → five; "single" → single
- Tail shapes: "round tail" / "round" → round; "squash" → squash; "pin" / "pintail" → pin; "swallow" → swallow
- Construction: "epoxy" → eps_epoxy; "poly" / "pu" → pu_poly; "carbon" → carbon
If a field is not mentioned, use null or [].
CRITICAL: Never invent brandText or modelText the user did not refer to. Obvious misspellings of well-known surf brands/models are allowed (e.g. "chanel islands" → Channel Islands, "dumpstr diver" → Dumpster Diver). If a Known catalog names list is provided, prefer those. Queries like "6 foot board" / "6 foot surfboard" are length-only — brandText and modelText must be null, lengthToken "6'0", residualText "".
Split the query into:
1) structured filters (brand/model/price/condition/fins/tail/construction/location/shipping/style)
2) residualText = ONLY leftover model words that help rank listings (e.g. "puddle jumper", "sub driver").
Never put brand names, prices, fin/tail words (fcs, thruster, round tail, …), "under"/"over"/"near", shipping, condition words, or generic words like "boards"/"surfboards"/"board" into residualText.
If the query is only filters (e.g. "lost under $800", "boards with fcs", "6 foot board"), residualText must be "".
Prices are USD integers.`,
      prompt: `Extract search filters from this query:\n"""${q}"""${synonymHintBlock(synonymExpansions)}`,
      temperature: 0,
      providerOptions: {
        gateway: {
          tags: gatewayTagsForFeature("marketplace_nl_search"),
        },
      },
    })

    if (!output) return null
    const parsed = marketplaceNlSearchIntentSchema.parse(output)
    // Merge deterministic fin aliases so "fcs" / "thruster" always become facets.
    const finSystems = uniqueStrings([
      ...parsed.finSystems,
      ...extractFinSystemsFromQuery(q),
    ])
    const finSetups = uniqueStrings([
      ...parsed.finSetups,
      ...extractFinSetupsFromQuery(q),
    ])
    const constructions = uniqueStrings([
      ...parsed.constructions,
      ...extractConstructionsFromQuery(q),
    ])
    const tailShapes = uniqueStrings([
      ...(parsed.tailShapes ?? []),
      ...extractTailShapesFromQuery(q),
    ])
    return { ...parsed, finSystems, finSetups, constructions, tailShapes }
  } catch (err) {
    console.error("[marketplaceQueryUnderstand] Gemini NL parse failed:", err)
    return null
  }
}

function uniqueStrings(values: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of values) {
    if (!v || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

const getCachedNlIntent = unstable_cache(
  async (normalizedQuery: string, expansionKey: string): Promise<MarketplaceNlSearchIntent | null> => {
    let expansions: string[] = []
    if (expansionKey) {
      try {
        const parsed: unknown = JSON.parse(expansionKey)
        if (Array.isArray(parsed)) {
          expansions = parsed.filter((item): item is string => typeof item === "string")
        }
      } catch {
        expansions = []
      }
    }
    return callGeminiForNlIntent(normalizedQuery, expansions)
  },
  ["marketplace-nl-search-v6"],
  { revalidate: NL_CACHE_SECONDS, tags: [MARKETPLACE_NL_SEARCH_CACHE_TAG] },
)

/**
 * Understand a marketplace NL query with Gemini (cached).
 * Returns null when disabled, skipped by heuristic, or the model fails.
 */
export async function understandMarketplaceQueryWithLlm(
  rawQuery: string,
  rulesParsed: MarketplaceParsedQuery,
  options?: { force?: boolean },
): Promise<MarketplaceNlSearchIntent | null> {
  if (!isMarketplaceNlSearchEnabled()) return null
  const q = rawQuery.trim()
  if (q.length < 2) return null
  // `force` is for admin/debug only — normal traffic uses the NL heuristic so
  // simple model queries (e.g. "dumpster diver 5'10") stay on the fast rules path.
  if (!options?.force && !marketplaceQueryLikelyNeedsLlm(q, rulesParsed)) return null

  const key = q.toLowerCase().replace(/\s+/g, " ")
  const expansions = uniqueStrings((rulesParsed.expansions ?? []).slice(0, MAX_SYNONYM_HINTS))
  return getCachedNlIntent(key, JSON.stringify(expansions))
}

/** Human-readable chips for the results banner. */
export function nlIntentToAppliedLabels(intent: MarketplaceNlSearchIntent): string[] {
  const chips: string[] = []
  if (intent.brandText?.trim()) chips.push(intent.brandText.trim())
  if (intent.modelText?.trim()) chips.push(intent.modelText.trim())
  if (intent.lengthToken?.trim()) chips.push(intent.lengthToken.trim())
  for (const s of intent.styles) chips.push(s.replace(/-/g, " "))
  for (const c of intent.conditions) chips.push(c.replace(/_/g, " "))
  for (const f of intent.finSystems) chips.push(finSystemLabel(f))
  for (const f of intent.finSetups) chips.push(finSetupLabel(f))
  for (const t of intent.tailShapes ?? []) chips.push(`${tailShapeLabel(t)} tail`)
  for (const c of intent.constructions) chips.push(constructionLabel(c))
  if (intent.maxPrice != null) chips.push(`under $${Math.round(intent.maxPrice)}`)
  if (intent.minPrice != null) chips.push(`from $${Math.round(intent.minPrice)}`)
  if (intent.locationText?.trim()) chips.push(intent.locationText.trim())
  if (intent.shippingAvailable) chips.push("shipping")
  return chips
}

/**
 * Rules-only facet overlay when Gemini is skipped/disabled but the query clearly
 * asks for fins, tails, or construction (e.g. "boards with fcs", "epoxy").
 */
export function rulesFinOverlayFromQuery(rawQuery: string): MarketplaceNlSearchIntent | null {
  const finSystems = extractFinSystemsFromQuery(rawQuery)
  const finSetups = extractFinSetupsFromQuery(rawQuery)
  const tailShapes = extractTailShapesFromQuery(rawQuery)
  const constructions = extractConstructionsFromQuery(rawQuery)
  if (
    finSystems.length === 0 &&
    finSetups.length === 0 &&
    tailShapes.length === 0 &&
    constructions.length === 0
  ) {
    return null
  }
  const labels = [
    ...finSystems.map(finSystemLabel),
    ...finSetups.map(finSetupLabel),
    ...tailShapes.map((t) => `${tailShapeLabel(t)} tail`),
    ...constructions.map(constructionLabel),
  ]
  return {
    brandText: null,
    modelText: null,
    residualText: "",
    styles: [],
    conditions: [],
    constructions,
    finSystems,
    finSetups,
    tailShapes,
    lengthToken: null,
    minPrice: null,
    maxPrice: null,
    locationText: null,
    shippingAvailable: null,
    summary: labels.join(" · "),
  }
}
