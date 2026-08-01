/**
 * Deterministic price cues from marketplace free-text (under/over/$N).
 * Complements Gemini NL parse so "lost under $800" still filters if the LLM misses.
 */

export type MarketplacePriceFilters = {
  minPrice?: number
  maxPrice?: number
}

function parseUsdAmount(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ""))
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null
  return Math.round(n)
}

/** Extract min/max USD from phrases like "under $800", "over 500", "between 400 and 700". */
export function extractPriceFiltersFromQuery(rawQuery: string): MarketplacePriceFilters {
  const q = (rawQuery || "").trim()
  if (!q) return {}

  const out: MarketplacePriceFilters = {}

  const between = q.match(
    /\bbetween\s*\$?\s*(\d{1,3}(?:,\d{3})*|\d+)\s*(?:and|to|-)\s*\$?\s*(\d{1,3}(?:,\d{3})*|\d+)\b/i,
  )
  if (between) {
    const a = parseUsdAmount(between[1]!)
    const b = parseUsdAmount(between[2]!)
    if (a != null && b != null) {
      out.minPrice = Math.min(a, b)
      out.maxPrice = Math.max(a, b)
      return out
    }
  }

  const under = q.match(
    /\b(?:under|below|less\s+than|max(?:imum)?|up\s+to)\s*\$?\s*(\d{1,3}(?:,\d{3})*|\d+)\b/i,
  )
  if (under) {
    const n = parseUsdAmount(under[1]!)
    if (n != null) out.maxPrice = n
  } else {
    const dollarMax = q.match(/\$\s*(\d{1,3}(?:,\d{3})*|\d+)\s*(?:or\s+less|and\s+under)?\b/i)
    if (dollarMax && /\b(under|below|less|max|budget|cheap)\b/i.test(q)) {
      const n = parseUsdAmount(dollarMax[1]!)
      if (n != null) out.maxPrice = n
    }
  }

  const over = q.match(
    /\b(?:over|above|more\s+than|at\s+least|min(?:imum)?|from)\s*\$?\s*(\d{1,3}(?:,\d{3})*|\d+)\b/i,
  )
  if (over) {
    const n = parseUsdAmount(over[1]!)
    if (n != null) out.minPrice = n
  }

  return out
}

export function queryMentionsPriceFilters(rawQuery: string): boolean {
  const { minPrice, maxPrice } = extractPriceFiltersFromQuery(rawQuery)
  return minPrice != null || maxPrice != null
}
