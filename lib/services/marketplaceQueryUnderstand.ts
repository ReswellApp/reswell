/**
 * Natural-language marketplace query understanding via Gemini (AI Gateway).
 *
 * Role: compile free-text into structured `/boards` filters. Retrieval stays
 * Elasticsearch — the LLM does not scan listing rows.
 */

import { unstable_cache } from "next/cache"
import { generateText, Output } from "ai"
import {
  marketplaceNlSearchIntentSchema,
  type MarketplaceNlSearchIntent,
} from "@/lib/validations/marketplaceNlSearch"
import type { MarketplaceParsedQuery } from "@/lib/services/marketplaceQueryParse"
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

const NL_CACHE_TAG = "marketplace-nl-search"
const NL_CACHE_SECONDS = 60 * 30

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
    queryMentionsFinFilters(q) ||
    queryMentionsTailFilters(q) ||
    queryMentionsConstructionFilters(q)

  if (nlSignals) return true

  // Multi-token queries with no structured brand/model hit still benefit from NL.
  const tokens = lower.match(/[\w']+/g) ?? []
  if (tokens.length >= 4 && !rulesParsed.model && rulesParsed.modelIds.length === 0) {
    return true
  }

  return false
}

async function callGeminiForNlIntent(rawQuery: string): Promise<MarketplaceNlSearchIntent | null> {
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
- "CI" → brandText "Channel Islands"; "Lost" → brandText "Lost Surfboards"
- Fin SYSTEMS (plugs): "fcs" / "fcs2" / "fcs ii" → fcs_ii; "futures" → futures; "twin tab" → fcs_twin_tab; "glass on" → glass_on
- Fin SETUPS (layout): "thruster" / "tri" → thruster; "twin" → twin_only; "2+1" → twin; "quad" → quad; "5-fin" → five; "single" → single
- Tail shapes: "round tail" / "round" → round; "squash" → squash; "pin" / "pintail" → pin; "swallow" → swallow
- Construction: "epoxy" → eps_epoxy; "poly" / "pu" → pu_poly; "carbon" → carbon
If a field is not mentioned, use null or [].
Split the query into:
1) structured filters (brand/model/price/condition/fins/tail/construction/location/shipping/style)
2) residualText = ONLY leftover model words that help rank listings (e.g. "puddle jumper", "sub driver").
Never put brand names, prices, fin/tail words (fcs, thruster, round tail, …), "under"/"over"/"near", shipping, condition words, or generic words like "boards"/"surfboards" into residualText.
If the query is only filters (e.g. "lost under $800", "boards with fcs", "lost round tail"), residualText must be "".
Prices are USD integers.`,
      prompt: `Extract search filters from this query:\n"""${q}"""`,
      temperature: 0,
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
  async (normalizedQuery: string): Promise<MarketplaceNlSearchIntent | null> => {
    return callGeminiForNlIntent(normalizedQuery)
  },
  ["marketplace-nl-search-v4"],
  { revalidate: NL_CACHE_SECONDS, tags: [NL_CACHE_TAG] },
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
  return getCachedNlIntent(key)
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
