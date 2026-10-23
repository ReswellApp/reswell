/**
 * In-process mirror of `brandInventoryOrClause` in `lib/db/brand-listings.ts`.
 * Saved-search alerts use this so "lost surfboards" means the Lost / Mayhem
 * brand, not the word "lost" somewhere in a description.
 */

import { isElasticsearchIndexedListingSection } from "@/lib/elasticsearch/listing-sections"
import { brandLegacyRecallTokens } from "@/lib/utils/marketplace-brand-query"
import { brandTextAliasesForSearch } from "@/lib/utils/marketplace-brand-synonyms"

export type DirectoryBrandListingFields = {
  brand_id?: string | null
  brand?: string | null
  title?: string | null
  model?: string | null
  section?: string | null
}

function fieldIncludes(value: string | null | undefined, needle: string): boolean {
  const hay = (value ?? "").trim().toLowerCase()
  const n = needle.trim().toLowerCase()
  if (!hay || !n) return false
  return hay.includes(n)
}

function tokenHits(
  token: string,
  fields: Array<string | null | undefined>,
): boolean {
  if (token.trim().length < 4) return false
  return fields.some((field) => fieldIncludes(field, token))
}

/**
 * True when a listing would show in directory brand inventory:
 * `brand_id`, official brand text, synonym aliases (Lost ↔ Mayhem) on brand
 * or title, and last-name / legacy title tokens. Description is not a signal.
 */
export function listingMatchesDirectoryBrandInventory(
  listing: DirectoryBrandListingFields,
  brand: { id: string; name: string },
): boolean {
  const brandId = brand.id.trim()
  if (brandId && (listing.brand_id ?? "").trim() === brandId) return true

  const name = brand.name.trim()
  if (name && fieldIncludes(listing.brand, name)) return true

  for (const alias of brandTextAliasesForSearch(name)) {
    if (tokenHits(alias, [listing.brand, listing.title])) return true
  }

  const fullNameLower = name.toLowerCase()
  for (const token of brandLegacyRecallTokens(name)) {
    const fields: Array<string | null | undefined> = [listing.title, listing.model]
    if (token !== fullNameLower) fields.unshift(listing.brand)
    if (tokenHits(token, fields)) return true
  }

  return false
}

/**
 * Brand-only marketplace queries ("lost surfboards") match brand inventory.
 * Returns null when the query is not brand-only so the caller can keep going.
 * A section intent ("channel islands fins") must match the listing section.
 * With no section intent, only Elasticsearch-indexed peer sections match —
 * the same set `/search` uses.
 */
export function listingMatchesBrandOnlyQuery(
  listing: DirectoryBrandListingFields,
  input: {
    isBrandOnly: boolean
    brand: { id: string; name: string } | null
    sectionIntent: string | null
  },
): boolean | null {
  if (!input.isBrandOnly || !input.brand) return null

  if (input.sectionIntent) {
    if (listing.section !== input.sectionIntent) return false
  } else if (!isElasticsearchIndexedListingSection(listing.section ?? "")) {
    return false
  }

  return listingMatchesDirectoryBrandInventory(listing, input.brand)
}
