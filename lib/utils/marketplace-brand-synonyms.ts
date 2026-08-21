/**
 * Built-in marketplace brand aliases that must recall the same listings.
 * Lost Surfboards is “…Lost by Mayhem” — sellers list it as Lost or Mayhem.
 */

/** Equivalent brand tokens (any member should retrieve the others). */
export const MARKETPLACE_BRAND_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["lost", "mayhem"],
]

function tokenize(raw: string): string[] {
  const tokens = raw.toLowerCase().match(/[\w']+/g) ?? []
  const out: string[] = []
  const seen = new Set<string>()
  for (const token of tokens) {
    const core = token.replace(/^['']+|['']+$/g, "")
    if (core.length < 2 || seen.has(core)) continue
    seen.add(core)
    out.push(core)
  }
  return out
}

function groupForHaystack(haystack: string): readonly string[] | null {
  const tokens = new Set(tokenize(haystack))
  if (tokens.size === 0) return null
  for (const group of MARKETPLACE_BRAND_SYNONYM_GROUPS) {
    if (group.some((alias) => tokens.has(alias))) return group
  }
  return null
}

/** Extra query labels to try when resolving a directory brand (e.g. "mayhem" → "lost"). */
export function marketplaceBrandSynonymCandidates(raw: string): string[] {
  const group = groupForHaystack(raw)
  if (!group) return []
  const tokens = new Set(tokenize(raw))
  return group.filter((alias) => !tokens.has(alias))
}

/**
 * Alias tokens to treat as the same brand as `brandName`
 * (e.g. Lost Surfboards → lost, mayhem).
 */
export function brandTextAliasesForSearch(brandName: string): string[] {
  const group = groupForHaystack(brandName)
  return group ? [...group] : []
}

/** True when the typed query is a known alias of this catalog brand name. */
export function brandNamesAreSearchSynonyms(query: string, brandName: string): boolean {
  const queryGroup = groupForHaystack(query)
  const brandGroup = groupForHaystack(brandName)
  return Boolean(queryGroup && brandGroup && queryGroup === brandGroup)
}

/** Built-in synonym rows for the marketplace query expander (term + expansions). */
export function builtinMarketplaceSearchSynonymRows(): Array<{
  term: string
  expansions: string[]
}> {
  return MARKETPLACE_BRAND_SYNONYM_GROUPS.map((group) => ({
    term: group[0] ?? "",
    expansions: group.slice(1).filter(Boolean),
  })).filter((row) => row.term && row.expansions.length > 0)
}
