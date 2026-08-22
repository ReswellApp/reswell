import { slugify } from "@/lib/slugify"
import {
  isMarketplaceSearchNoiseToken,
  pickClosestBrandNameMatch,
} from "@/lib/utils/marketplace-brand-query"
import {
  isGenericSurfSearchToken,
  isMarketplaceGenericSurfSearchOnly,
} from "@/lib/utils/marketplace-style-query"
import { brandNamesAreSearchSynonyms } from "@/lib/utils/marketplace-brand-synonyms"

export type BrandNavPickRow = { name: string; slug: string }

function queryBrandTokens(lowerQuery: string): string[] {
  const tokens = lowerQuery.match(/[\w']+/g) ?? []
  return tokens
    .map((t) => t.replace(/^['']+|['']+$/g, ""))
    .filter(
      (t) =>
        t.length >= 3 &&
        !isMarketplaceSearchNoiseToken(t) &&
        !isGenericSurfSearchToken(t),
    )
}

/**
 * Map a user-picked label (often listing `brand` text like "Channel Islands") to a
 * `public.brands` row from catalog-suggest results. Never use `rows[0]` alone:
 * Elasticsearch relevance ordering can surface unrelated brands first, or omit
 * the true match from a capped page of results.
 */
export function pickCatalogBrandForNavPick(
  rows: BrandNavPickRow[],
  pickedLabel: string,
): BrandNavPickRow | null {
  const q = pickedLabel.trim()
  if (!q || rows.length === 0) return null
  const lower = q.toLowerCase()
  const slugHint = slugify(q).toLowerCase()
  const queryTokens = queryBrandTokens(lower)

  const exact = rows.find((r) => r.name.toLowerCase() === lower)
  if (exact) return exact

  const synonym = rows.find((r) => brandNamesAreSearchSynonyms(lower, r.name))
  if (synonym) return synonym

  // Substring / prefix matches ("fish" → "Fish Stix", "fish twin" → same)
  // are typeahead-only noise when the query is only shape / fin-layout words.
  // Exact / synonym still win above.
  if (isMarketplaceGenericSurfSearchOnly(q)) return null

  const extendedName = rows.find((r) => {
    const n = r.name.toLowerCase()
    return n.startsWith(lower + " ") || n.startsWith(lower + "·")
  })
  if (extendedName) return extendedName

  const nameContains = rows.find((r) => r.name.toLowerCase().includes(lower))
  if (nameContains) return nameContains

  const queryContainsBrand = rows.find((r) => {
    const brandLower = r.name.toLowerCase()
    if (brandLower.length < 3) return false
    return lower.includes(brandLower)
  })
  if (queryContainsBrand) return queryContainsBrand

  const tokenOverlap = rows.find((r) => {
    const brandLower = r.name.toLowerCase()
    const brandTokens = (brandLower.match(/[\w']+/g) ?? [brandLower]).filter(
      (bt) => bt.length >= 3 && !isMarketplaceSearchNoiseToken(bt) && !isGenericSurfSearchToken(bt),
    )
    if (brandTokens.length === 0) return false
    return queryTokens.some((qt) => {
      if (brandLower === qt || brandLower.startsWith(qt) || qt.startsWith(brandLower)) {
        return true
      }
      return brandTokens.some(
        (bt) => bt === qt || bt.startsWith(qt) || qt.startsWith(bt),
      )
    })
  })
  if (tokenOverlap) return tokenOverlap

  /** Mid-typing fragments: "channel is" → "is" prefixes "islands" in Channel Islands. */
  const shortFragments = (lower.match(/[\w']+/g) ?? [])
    .map((t) => t.replace(/^['']+|['']+$/g, ""))
    .filter((t) => t.length === 2 && !isMarketplaceSearchNoiseToken(t))
  const fragmentPrefix = rows.find((r) => {
    const brandTokens = r.name.toLowerCase().match(/[\w']+/g) ?? []
    return shortFragments.some((frag) =>
      brandTokens.some((bt) => bt.length >= 3 && bt.startsWith(frag)),
    )
  })
  if (fragmentPrefix) return fragmentPrefix

  if (slugHint) {
    const bySlug = rows.find((r) => {
      const s = r.slug.toLowerCase()
      return s === slugHint || s.startsWith(`${slugHint}-`)
    })
    if (bySlug) return bySlug

    for (const token of queryTokens) {
      const tokenSlug = slugify(token).toLowerCase()
      if (!tokenSlug) continue
      const byTokenSlug = rows.find((r) => {
        const s = r.slug.toLowerCase()
        return s === tokenSlug || s.startsWith(`${tokenSlug}-`)
      })
      if (byTokenSlug) return byTokenSlug
    }
  }

  const fuzzy = pickClosestBrandNameMatch(rows, q)
  if (fuzzy) return fuzzy

  return null
}
