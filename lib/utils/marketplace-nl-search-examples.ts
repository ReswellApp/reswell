/**
 * Contextual "Try …" natural-language search examples derived from the user's query.
 * Pure — safe for client + server.
 */

export type MarketplaceNlSearchExample = {
  label: string
  href: string
}

const FALLBACK_EXAMPLES: readonly MarketplaceNlSearchExample[] = [
  {
    label: "Dumpster Diver 5'10 excellent under $600",
    href: "/boards?q=Dumpster%20Diver%205%2710%20excellent%20under%20%24600&nq=1",
  },
  {
    label: "boards with FCS thruster",
    href: "/boards?q=boards%20with%20FCS%20thruster&nq=1",
  },
]

function boardsHrefFromQuery(label: string): string {
  const params = new URLSearchParams()
  params.set("q", label)
  params.set("nq", "1")
  return `/boards?${params.toString()}`
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

function hasPrice(q: string): boolean {
  return /\$\s*\d+/.test(q) || /\b\d{2,5}\s*(?:dollars|usd)\b/i.test(q) || /\bunder\s+\d/i.test(q)
}

function hasCondition(q: string): boolean {
  return /\b(excellent|very\s+good|good|fair|brand\s+new|like\s+new|mint|new)\b/i.test(q)
}

function hasFinLanguage(q: string): boolean {
  return /\b(fcs|futures|thruster|quad|twin|single|fin\s*system|glass[\s-]?on)\b/i.test(q)
}

function hasLength(q: string): boolean {
  return (
    /\b\d{1,2}\s*(?:foot|feet|ft)\b/i.test(q) ||
    /\b\d{1,2}'\s*\d{0,2}\b/.test(q) ||
    /\b\d{1,2}\s+\d{1,2}\b/.test(q)
  )
}

function hasShipping(q: string): boolean {
  return /\b(shipping|ships?|pickup|pick\s*up)\b/i.test(q)
}

function basePhrase(rawQuery: string): string {
  return collapseWhitespace(rawQuery)
}

/**
 * Build up to two NL search suggestions that extend the user's current query
 * with missing dimensions (price, condition, fins, length, shipping).
 */
export function marketplaceNlSearchExamplesFromQuery(
  rawQuery: string,
): MarketplaceNlSearchExample[] {
  const base = basePhrase(rawQuery)
  if (base.length < 2) return [...FALLBACK_EXAMPLES]

  const candidates: string[] = []
  const push = (label: string) => {
    const t = collapseWhitespace(label)
    if (t.length < 4) return
    if (t.toLowerCase() === base.toLowerCase()) return
    if (candidates.some((c) => c.toLowerCase() === t.toLowerCase())) return
    candidates.push(t)
  }

  // Prefer refinements the query is missing — keep the user's words as the stem.
  if (!hasPrice(base)) {
    push(`${base} under $600`)
  }
  if (!hasCondition(base)) {
    push(`${base} excellent`)
  }
  if (!hasFinLanguage(base)) {
    push(`${base} with FCS thruster`)
  }
  if (!hasLength(base)) {
    push(`${base} 5'10`)
  }
  if (!hasShipping(base) && hasPrice(base)) {
    push(`${base} with shipping`)
  }

  // If the query already has most dimensions, offer a tighter / alternate price angle.
  if (candidates.length === 0) {
    if (hasPrice(base)) push(`${base} excellent`)
    else push(`${base} under $800`)
    if (!hasFinLanguage(base)) push(`${base} with futures thruster`)
  }

  const picked = candidates.slice(0, 2)
  if (picked.length === 0) return [...FALLBACK_EXAMPLES]

  return picked.map((label) => ({
    label,
    href: boardsHrefFromQuery(label),
  }))
}

/** One-line italic example for the hint body (first contextual suggestion). */
export function marketplaceNlSearchLeadExample(rawQuery: string): string {
  return marketplaceNlSearchExamplesFromQuery(rawQuery)[0]?.label ?? FALLBACK_EXAMPLES[0].label
}
