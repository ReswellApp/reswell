import {
  MOBILE_BOARD_TYPES,
  MOBILE_LISTING_CATEGORIES,
  mobileSearchResultsSchema,
  mobileSearchSchema,
  type MobileBoardType,
  type MobileListingCategory,
  type MobileSearch,
  type MobileSearchResults,
} from "@reswell/api-contract"
import { listMobileListingRowsByIds } from "@/lib/db/mobile-listings"
import { isListingPubliclyVisible } from "@/lib/listing-public-visibility"
import { resolveDirectoryBrandRowFromLabel } from "@/lib/services/brandDirectorySearch"
import { parseMarketplaceQuery } from "@/lib/services/marketplaceQueryParse"
import { resolveSearchListings } from "@/lib/services/marketplaceSearchResults"
import { runMarketplaceSearchSuggest } from "@/lib/services/marketplaceSearchSuggest"
import { toMobileListingCard, type MobileApiResult } from "@/lib/services/mobileApi"
import { getDb } from "@/lib/supabase/db"
import {
  extractMarketplaceSectionIntent,
  isMarketplaceSectionOnlyQuery,
} from "@/lib/utils/marketplace-brand-query"
import {
  extractBoardStylesFromQuery,
  isMarketplaceBoardStyleOnlyQuery,
  isMarketplaceGenericSurfSearchOnly,
} from "@/lib/utils/marketplace-style-query"

const SECTION_CATEGORY: Partial<Record<string, MobileListingCategory>> = {
  fins: "fins",
  wetsuits: "wetsuits",
  magazines: "magazines",
  surfboards: "surfboards",
  apparel: "apparel",
  traction: "traction",
}

/**
 * Same ranking as the website header search: Elasticsearch when configured,
 * then hydrate only listings that are still active and visible.
 */
export async function searchMobileListingsService(
  query: string,
): Promise<MobileApiResult<MobileSearch>> {
  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })
  const suggest = await runMarketplaceSearchSuggest(supabase, query, "marketplace")
  const ids = suggest.listings.map((listing) => listing.id)
  if (ids.length === 0) {
    return { ok: true, data: { listings: [] } }
  }

  const listed = await listMobileListingRowsByIds(ids)
  if (!listed.ok) {
    return { ok: false, status: 500, error: "Unable to search listings right now" }
  }

  const listings = listed.rows.flatMap((row) => {
    if (!isListingPubliclyVisible(row)) return []
    const card = toMobileListingCard(row)
    return card ? [card] : []
  })

  const parsed = mobileSearchSchema.safeParse({ listings })
  if (!parsed.success) {
    return { ok: false, status: 500, error: "Unable to search listings right now" }
  }
  return { ok: true, data: parsed.data }
}

/** Same result set as the website `/search` page, as mobile listing cards. */
export async function searchMobileResultsService(
  query: string,
): Promise<MobileApiResult<MobileSearchResults>> {
  const trimmed = query.trim()
  const browse = browseTargetForQuery(trimmed)
  if (browse) {
    const parsed = mobileSearchResultsSchema.safeParse({
      query: trimmed,
      listings: [],
      browse,
      summary: null,
    })
    if (!parsed.success) {
      return { ok: false, status: 500, error: "Unable to search listings right now" }
    }
    return { ok: true, data: parsed.data }
  }

  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })
  const parsedQuery = await parseMarketplaceQuery(supabase, trimmed)
  let brand: { id: string; name: string; slug: string } | null = parsedQuery.brand
    ? {
        id: parsedQuery.brand.id,
        name: parsedQuery.brand.name,
        slug: parsedQuery.brand.slug,
      }
    : null
  if (
    !brand &&
    !parsedQuery.model &&
    !isMarketplaceSectionOnlyQuery(trimmed) &&
    !isMarketplaceBoardStyleOnlyQuery(trimmed) &&
    !isMarketplaceGenericSurfSearchOnly(trimmed)
  ) {
    brand = await resolveDirectoryBrandRowFromLabel(supabase, trimmed)
  }

  const resolved = await resolveSearchListings(supabase, trimmed, null, brand, parsedQuery, false)
  const listed = await listMobileListingRowsByIds(resolved.listings.map((listing) => listing.id))
  if (!listed.ok) {
    return { ok: false, status: 500, error: "Unable to search listings right now" }
  }

  const listings = listed.rows.flatMap((row) => {
    if (!isListingPubliclyVisible(row)) return []
    const card = toMobileListingCard(row)
    return card ? [card] : []
  })
  const parsed = mobileSearchResultsSchema.safeParse({
    query: trimmed,
    listings,
    browse: null,
    summary: {
      model: parsedQuery.model?.name ?? null,
      brand: brand?.name ?? null,
      length: parsedQuery.lengthToken,
    },
  })
  if (!parsed.success) {
    return { ok: false, status: 500, error: "Unable to search listings right now" }
  }
  return { ok: true, data: parsed.data }
}

function browseTargetForQuery(query: string): MobileSearchResults["browse"] {
  if (isMarketplaceSectionOnlyQuery(query)) {
    const section = extractMarketplaceSectionIntent(query)
    const category = section ? SECTION_CATEGORY[section] : undefined
    if (category && isListingCategory(category)) {
      return { category, board_type: null }
    }
  }

  if (isMarketplaceBoardStyleOnlyQuery(query)) {
    const styles = extractBoardStylesFromQuery(query)
    const style = styles.length === 1 ? styles[0] : null
    if (style && isBoardType(style)) {
      return { category: "surfboards", board_type: style }
    }
  }

  return null
}

function isListingCategory(value: string): value is MobileListingCategory {
  return (MOBILE_LISTING_CATEGORIES as readonly string[]).includes(value)
}

function isBoardType(value: string): value is MobileBoardType {
  return (MOBILE_BOARD_TYPES as readonly string[]).includes(value)
}
