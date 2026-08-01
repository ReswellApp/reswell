/**
 * Deterministic price cues from marketplace free-text (under/over/$N).
 * Complements Gemini NL parse so "lost under $800" still filters if the LLM misses.
 *
 * Important: length phrases like "under 6 feet" must NOT become price filters.
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

/** True when a matched amount is clearly a board-length unit, not USD. */
function amountIsLengthUnit(query: string, matchIndex: number, matchText: string): boolean {
  const after = query.slice(matchIndex + matchText.length)
  if (/^\s*(?:feet|foot|ft|inches|inch|in)\b/i.test(after)) return true
  if (/^\s*['′]/i.test(after)) return true
  if (/^\s*\d{1,2}\s*(?:inches|inch|in|"|″)\b/i.test(after)) return true
  return false
}

/**
 * Bare "under 6" without $ is ambiguous; only treat as price when:
 * - `$` is present, or
 * - amount looks like a listing price (>= $50), or
 * - query has explicit money words (dollars/usd/budget/priced).
 */
function amountLooksLikePrice(query: string, amount: number, hadDollar: boolean): boolean {
  if (hadDollar) return true
  if (/\b(?:dollars|usd|budget|priced?|bucks)\b/i.test(query)) return true
  // Board prices are rarely single-digit; small bare numbers are almost always length.
  if (amount < 50) return false
  return true
}

/** Extract min/max USD from phrases like "under $800", "over 500", "between 400 and 700". */
export function extractPriceFiltersFromQuery(rawQuery: string): MarketplacePriceFilters {
  const q = (rawQuery || "").trim()
  if (!q) return {}

  const out: MarketplacePriceFilters = {}

  const between = q.match(
    /\bbetween\s*(\$?)\s*(\d{1,3}(?:,\d{3})*|\d+)\s*(?:and|to|-)\s*\$?\s*(\d{1,3}(?:,\d{3})*|\d+)\b/i,
  )
  if (between && between.index != null) {
    if (!amountIsLengthUnit(q, between.index, between[0]!)) {
      const a = parseUsdAmount(between[2]!)
      const b = parseUsdAmount(between[3]!)
      const hadDollar = between[1] === "$" || /\$/.test(between[0]!)
      if (
        a != null &&
        b != null &&
        amountLooksLikePrice(q, Math.max(a, b), hadDollar)
      ) {
        out.minPrice = Math.min(a, b)
        out.maxPrice = Math.max(a, b)
        return out
      }
    }
  }

  const underRe =
    /\b(?:under|below|less\s+than|max(?:imum)?|up\s+to)\s*(\$?)\s*(\d{1,3}(?:,\d{3})*|\d+)\b/i
  const under = underRe.exec(q)
  if (under && under.index != null) {
    if (!amountIsLengthUnit(q, under.index, under[0]!)) {
      const n = parseUsdAmount(under[2]!)
      const hadDollar = under[1] === "$"
      if (n != null && amountLooksLikePrice(q, n, hadDollar)) {
        out.maxPrice = n
      }
    }
  } else {
    const dollarMax = q.match(/\$\s*(\d{1,3}(?:,\d{3})*|\d+)\s*(?:or\s+less|and\s+under)?\b/i)
    if (dollarMax && /\b(under|below|less|max|budget|cheap)\b/i.test(q)) {
      const n = parseUsdAmount(dollarMax[1]!)
      if (n != null) out.maxPrice = n
    }
  }

  const overRe =
    /\b(?:over|above|more\s+than|at\s+least|min(?:imum)?|from)\s*(\$?)\s*(\d{1,3}(?:,\d{3})*|\d+)\b/i
  const over = overRe.exec(q)
  if (over && over.index != null) {
    if (!amountIsLengthUnit(q, over.index, over[0]!)) {
      const n = parseUsdAmount(over[2]!)
      const hadDollar = over[1] === "$"
      if (n != null && amountLooksLikePrice(q, n, hadDollar)) {
        out.minPrice = n
      }
    }
  }

  return out
}

export function queryMentionsPriceFilters(rawQuery: string): boolean {
  const { minPrice, maxPrice } = extractPriceFiltersFromQuery(rawQuery)
  return minPrice != null || maxPrice != null
}

/**
 * Drop LLM price guesses that conflict with length language or are implausibly low
 * without a `$` in the query (e.g. Gemini mapping "under 6 feet" → maxPrice 6).
 */
export function sanitizeNlPriceAgainstQuery(
  rawQuery: string,
  prices: { minPrice?: number | null; maxPrice?: number | null },
): { minPrice: number | null; maxPrice: number | null } {
  const q = rawQuery.trim()
  const hasDollar = /\$/.test(q)
  let minPrice = prices.minPrice ?? null
  let maxPrice = prices.maxPrice ?? null

  if (/\b(?:feet|foot|ft)\b/i.test(q) || /\d\s*['′]/.test(q)) {
    // Length-oriented query: only keep prices that were explicitly dollar-denominated.
    if (!hasDollar) {
      minPrice = null
      maxPrice = null
    }
  }

  if (maxPrice != null && maxPrice < 50 && !hasDollar) maxPrice = null
  if (minPrice != null && minPrice < 50 && !hasDollar) minPrice = null

  return { minPrice, maxPrice }
}
