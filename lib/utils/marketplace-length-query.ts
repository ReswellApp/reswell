/**
 * Deterministic length bounds from free-text (e.g. "under 6 feet", "over 7'").
 * Complements exact length tokens like 5'10 handled by marketplaceQueryParse.
 */

export type MarketplaceLengthBounds = {
  /** Inclusive lower bound in inches. */
  minLengthInches?: number
  /** Exclusive upper bound in inches (`under 6 feet` → 72). */
  maxLengthInches?: number
  /** Human chip label. */
  label?: string
}

function feetToInches(feet: number, inches = 0): number | null {
  if (!Number.isFinite(feet) || feet < 1 || feet > 15) return null
  if (!Number.isFinite(inches) || inches < 0 || inches >= 12) return null
  return Math.round(feet * 12 + inches)
}

/**
 * Extract min/max board length from phrases like "under 6 feet", "over 7'", "under 5'10".
 */
export function extractLengthBoundsFromQuery(rawQuery: string): MarketplaceLengthBounds {
  const q = (rawQuery || "").trim()
  if (!q) return {}

  // under/below/less than 5'10 or 5 10
  const underExact = q.match(
    /\b(?:under|below|less\s+than|up\s+to)\s+(\d{1,2})\s*['′]\s*(\d{1,2})?\b/i,
  )
  if (underExact) {
    const total = feetToInches(Number(underExact[1]), underExact[2] ? Number(underExact[2]) : 0)
    if (total != null) {
      const label =
        underExact[2] != null
          ? `under ${underExact[1]}'${underExact[2]}`
          : `under ${underExact[1]}'`
      return { maxLengthInches: total, label }
    }
  }

  // under/below N feet|ft|foot
  const underFeet = q.match(
    /\b(?:under|below|less\s+than|up\s+to)\s+(\d{1,2})(?:\.\d+)?\s*(?:feet|foot|ft)\b/i,
  )
  if (underFeet) {
    const total = feetToInches(Number(underFeet[1]), 0)
    if (total != null) {
      return { maxLengthInches: total, label: `under ${underFeet[1]}'` }
    }
  }

  // over/above/at least N feet|ft
  const overFeet = q.match(
    /\b(?:over|above|more\s+than|at\s+least|from)\s+(\d{1,2})(?:\.\d+)?\s*(?:feet|foot|ft)\b/i,
  )
  if (overFeet) {
    const total = feetToInches(Number(overFeet[1]), 0)
    if (total != null) {
      return { minLengthInches: total, label: `over ${overFeet[1]}'` }
    }
  }

  const overExact = q.match(
    /\b(?:over|above|more\s+than|at\s+least|from)\s+(\d{1,2})\s*['′]\s*(\d{1,2})?\b/i,
  )
  if (overExact) {
    const total = feetToInches(Number(overExact[1]), overExact[2] ? Number(overExact[2]) : 0)
    if (total != null) {
      const label =
        overExact[2] != null
          ? `over ${overExact[1]}'${overExact[2]}`
          : `over ${overExact[1]}'`
      return { minLengthInches: total, label }
    }
  }

  return {}
}

export function queryMentionsLengthBounds(rawQuery: string): boolean {
  const b = extractLengthBoundsFromQuery(rawQuery)
  return b.minLengthInches != null || b.maxLengthInches != null
}
