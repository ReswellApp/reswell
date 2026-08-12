import { unstable_cache, revalidateTag } from "next/cache"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { listEnabledSearchSynonyms, type SearchSynonymRow } from "@/lib/db/searchCuration"
import {
  compactSearchCurationKey,
  normalizeSearchCurationKey,
} from "@/lib/validations/searchCuration"
import { levenshteinDistance, maxBrandTypoDistance } from "@/lib/utils/marketplace-brand-query"

export const SEARCH_SYNONYMS_CACHE_TAG = "search-synonyms"

const loadEnabledSynonyms = unstable_cache(
  async (): Promise<SearchSynonymRow[]> => {
    try {
      const service = createServiceRoleClient()
      return await listEnabledSearchSynonyms(service)
    } catch (e) {
      console.error("[searchSynonyms] load failed:", e)
      return []
    }
  },
  ["search-synonyms-active-v1"],
  { tags: [SEARCH_SYNONYMS_CACHE_TAG], revalidate: 300 },
)

export async function getActiveSearchSynonyms(): Promise<SearchSynonymRow[]> {
  return loadEnabledSynonyms()
}

/** Call after any admin synonym write so search picks up the change. */
export function revalidateSearchSynonyms(): void {
  revalidateTag(SEARCH_SYNONYMS_CACHE_TAG, "max")
  // NL helper prompt includes matched expansions — drop cached intents.
  revalidateTag("marketplace-nl-search", "max")
}

/** Shared synonym expansions for `/search`, nav suggest, and `/boards` keyword. */
export async function expansionsForMarketplaceQuery(rawQuery: string): Promise<string[]> {
  const q = (rawQuery || "").trim()
  if (q.length < 2) return []
  return expandSearchQueryTerms(q, await getActiveSearchSynonyms())
}

/**
 * True when a curated synonym key (term or expansion) should fire for this query.
 * Exact / token / substring matches stay as they were; compacted form and a tight
 * edit-distance check recover spacing variants and typos without matching short words.
 */
export function synonymKeyMatchesQuery(rawQuery: string, key: string): boolean {
  const queryNorm = normalizeSearchCurationKey(rawQuery)
  const keyNorm = normalizeSearchCurationKey(key)
  if (!queryNorm || !keyNorm) return false

  const queryCompact = compactSearchCurationKey(queryNorm)
  const keyCompact = compactSearchCurationKey(keyNorm)
  const queryTokenList = queryNorm.split(" ").filter(Boolean)
  const queryTokens = new Set(queryTokenList)
  const isMultiWord = keyNorm.includes(" ")

  if (isMultiWord) {
    if (queryNorm === keyNorm || queryNorm.includes(keyNorm)) return true
  } else if (queryNorm === keyNorm || queryTokens.has(keyNorm)) {
    return true
  }

  // "podmod" ↔ "pod mod"
  if (queryCompact.length >= 4 && keyCompact.length >= 4 && queryCompact === keyCompact) {
    return true
  }

  // Whole-query typo against the key ("chanel islands" ↔ "channel islands").
  if (queryCompact.length >= 5 && keyCompact.length >= 5) {
    const allowed = maxBrandTypoDistance(queryCompact.length, keyCompact.length)
    if (allowed > 0 && levenshteinDistance(queryCompact, keyCompact) <= allowed) {
      return true
    }
  }

  // Same-length token windows so "chanel islands under 800" still hits "channel islands".
  if (isMultiWord) {
    const keyTokenCount = keyNorm.split(" ").filter(Boolean).length
    if (keyTokenCount >= 2 && queryTokenList.length >= keyTokenCount) {
      for (let i = 0; i <= queryTokenList.length - keyTokenCount; i++) {
        const window = queryTokenList.slice(i, i + keyTokenCount).join(" ")
        const windowCompact = compactSearchCurationKey(window)
        if (windowCompact.length >= 4 && windowCompact === keyCompact) return true
        if (windowCompact.length >= 5 && keyCompact.length >= 5) {
          const allowed = maxBrandTypoDistance(windowCompact.length, keyCompact.length)
          if (allowed > 0 && levenshteinDistance(windowCompact, keyCompact) <= allowed) {
            return true
          }
        }
      }
    }
  }

  // Single-token typo against a single-word key ("dumpstr" ↔ "dumpster").
  if (!isMultiWord && keyNorm.length >= 5) {
    for (const token of queryTokenList) {
      if (token.length < 5) continue
      const allowed = maxBrandTypoDistance(token.length, keyNorm.length)
      if (allowed > 0 && levenshteinDistance(token, keyNorm) <= allowed) return true
    }
  }

  return false
}

/**
 * Returns extra OR-terms to widen a search, based on enabled synonyms.
 * Matches when the whole normalized query equals a synonym term, or a single-word
 * term appears as one of the query tokens. Also matches compacted spacing and
 * close typos of the term or its expansions.
 */
export function expandSearchQueryTerms(
  rawQuery: string,
  synonyms: SearchSynonymRow[],
): string[] {
  const normalizedQuery = normalizeSearchCurationKey(rawQuery)
  if (!normalizedQuery) return []

  const tokens = new Set(normalizedQuery.split(" ").filter(Boolean))
  const out: string[] = []
  const seen = new Set<string>()

  for (const syn of synonyms) {
    const keys = [syn.term, ...syn.expansions]
    const matched = keys.some((key) => synonymKeyMatchesQuery(normalizedQuery, key))
    if (!matched) continue

    for (const expansion of syn.expansions) {
      const value = expansion.trim()
      const key = value.toLowerCase()
      if (!value || seen.has(key) || tokens.has(key)) continue
      seen.add(key)
      out.push(value)
    }
  }

  return out
}
