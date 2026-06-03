import { unstable_cache, revalidateTag } from "next/cache"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { listEnabledSearchSynonyms, type SearchSynonymRow } from "@/lib/db/searchCuration"
import { normalizeSearchCurationKey } from "@/lib/validations/searchCuration"

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
  revalidateTag(SEARCH_SYNONYMS_CACHE_TAG)
}

/**
 * Returns extra OR-terms to widen a search, based on enabled synonyms.
 * Matches when the whole normalized query equals a synonym term, or a single-word
 * term appears as one of the query tokens. Conservative to avoid over-expansion.
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
    const termNorm = normalizeSearchCurationKey(syn.term)
    if (!termNorm) continue

    const isMultiWord = termNorm.includes(" ")
    const matched = isMultiWord
      ? normalizedQuery === termNorm || normalizedQuery.includes(termNorm)
      : normalizedQuery === termNorm || tokens.has(termNorm)
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
