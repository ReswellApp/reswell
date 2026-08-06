/**
 * Natural-language `/sell` catalog query understanding via the AI Gateway.
 *
 * Dedicated to the sell flow — independent config, prompt, and cache from the
 * marketplace (`/boards`) NL search. Role: normalize messy seller text into a
 * clean brand/model/category so catalog retrieval (Elasticsearch) can match it.
 * The LLM never scans catalog rows.
 */

import { unstable_cache } from "next/cache"
import { generateText, Output } from "ai"
import {
  sellCatalogNlSearchIntentSchema,
  type SellCatalogNlSearchIntent,
} from "@/lib/validations/sellCatalogNlSearch"

const NL_CACHE_TAG = "sell-catalog-nl-search"
const NL_CACHE_SECONDS = 60 * 30

/** Default: Gemini Flash via Vercel AI Gateway (`AI_GATEWAY_API_KEY` or OIDC). */
function sellCatalogNlModelId(): string {
  return process.env.SELL_CATALOG_NL_SEARCH_MODEL?.trim() || "google/gemini-2.5-flash"
}

export function isSellCatalogNlSearchEnabled(): boolean {
  if (process.env.SELL_CATALOG_NL_SEARCH_ENABLED === "false") return false
  return (
    process.env.SELL_CATALOG_NL_SEARCH_ENABLED === "true" ||
    Boolean(process.env.AI_GATEWAY_API_KEY?.trim()) ||
    Boolean(process.env.VERCEL_OIDC_TOKEN?.trim())
  )
}

/**
 * Heuristic: the catalog ES search handles clean brand/model text well — only
 * call the LLM when the query carries noise it can strip (dimensions, condition,
 * descriptors) or is multi-token and may need brand normalization.
 */
export function sellCatalogQueryLikelyNeedsLlm(rawQuery: string): boolean {
  const q = rawQuery.trim()
  if (q.length < 4) return false

  const lower = q.toLowerCase()
  const noiseSignals =
    // Dimensions / sizes: 9'6, 9 ft, 6 foot, 4/3, size M
    /\b\d{1,2}\s*['’]\s*\d{0,2}\b/.test(lower) ||
    /\b\d{1,2}\s*(?:foot|feet|ft)\b/.test(lower) ||
    /\b\d\s*\/\s*\d\b/.test(lower) ||
    /\bsize\s+\w+\b/.test(lower) ||
    // Condition / listing chatter
    /\b(new|used|mint|excellent|good|fair|condition|barely|never|dings?|repaired)\b/.test(
      lower,
    ) ||
    // Category words the catalog names don't contain
    /\b(longboard|shortboard|log|fish|board|surfboard|fin|fins|wetsuit|suit|steamer|springsuit|hoodie|tee|shirt)\b/.test(
      lower,
    )

  if (noiseSignals) return true

  // Multi-token queries can still benefit from brand-spelling normalization.
  const tokens = lower.match(/[\w'’]+/g) ?? []
  return tokens.length >= 2
}

async function callLlmForSellCatalogIntent(
  rawQuery: string,
): Promise<SellCatalogNlSearchIntent | null> {
  const q = rawQuery.trim()
  if (q.length < 2) return null

  try {
    const { output } = await generateText({
      model: sellCatalogNlModelId(),
      output: Output.object({ schema: sellCatalogNlSearchIntentSchema }),
      system: `You help sellers on Reswell (a surf marketplace) find their product in our brand/model catalog when they start a listing.
Extract the brand name, model name, and product category from the seller's search text.

Categories (use exactly one, or null when unclear):
- "surfboards": longboards, shortboards, logs, fish, mid-lengths, eggs, guns
- "fins": surfboard fins, keels, side bites, fin sets (FCS, Futures, glass-on)
- "wetsuits": fullsuits, springsuits, steamers, tops, thickness like 4/3 or 3/2
- "apparel": tees, hoodies, hats, boardshorts, clothing

Rules:
- Fix obvious misspellings of surf brands: "gato heiro"/"gato heroy" → "Gato Heroi"; "chanel islands"/"CI" → "Channel Islands"; "true aims"/"trueames" → "True Ames"; "haydenshapes" → "Haydenshapes".
- brandText is the canonical brand name only. modelText is the model/shape name only.
- Strip dimensions (9'6", 6 foot, 4/3), condition words (used, mint, great condition), colors, years, and category words (board, longboard, fin, wetsuit) out of brandText and modelText.
- Never invent a brand or model the seller did not reference. If the text is only descriptive ("9'6 longboard single fin"), brandText and modelText must be null — but still set the category.
- A board model mentioned with "fins for" is category "fins" ("fins for my CI fish" → fins). The board name alone is "surfboards".
- summary is a short interpretation like "Gato Heroi Dagger surfboard" or "9'6 longboard".`,
      prompt: `Extract the catalog intent from this seller search:\n"""${q}"""`,
      temperature: 0,
    })

    if (!output) return null
    return sellCatalogNlSearchIntentSchema.parse(output)
  } catch (err) {
    console.error("[sellCatalogQueryUnderstand] NL parse failed:", err)
    return null
  }
}

const getCachedSellCatalogIntent = unstable_cache(
  async (normalizedQuery: string): Promise<SellCatalogNlSearchIntent | null> => {
    return callLlmForSellCatalogIntent(normalizedQuery)
  },
  ["sell-catalog-nl-search-v1"],
  { revalidate: NL_CACHE_SECONDS, tags: [NL_CACHE_TAG] },
)

/**
 * Understand a `/sell` catalog search with the LLM (cached 30 min).
 * Returns null when disabled, skipped by heuristic, or the model fails.
 */
export async function understandSellCatalogQueryWithLlm(
  rawQuery: string,
  options?: { force?: boolean },
): Promise<SellCatalogNlSearchIntent | null> {
  if (!isSellCatalogNlSearchEnabled()) return null
  const q = rawQuery.trim()
  if (q.length < 2) return null
  if (!options?.force && !sellCatalogQueryLikelyNeedsLlm(q)) return null

  const key = q.toLowerCase().replace(/\s+/g, " ")
  return getCachedSellCatalogIntent(key)
}
