import type { SupabaseClient } from "@supabase/supabase-js"
import type { RecentListing } from "@/components/recent-feed-client"
import { marketplaceModelPageHrefFromParsed } from "@/lib/models/search-redirect"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { ELASTICSEARCH_INDEXED_LISTING_SECTIONS } from "@/lib/elasticsearch/listing-sections"
import {
  meaningfulSearchTerms,
  searchListingIdsFromElasticsearch,
} from "@/lib/elasticsearch/listings-index"
import {
  brandLegacyRecallTokens,
  fuzzyBrandNamePrefix,
  isLikelyTypoBrandMatch,
  isMarketplaceSectionOnlyQuery,
  stripMarketplaceSearchNoiseWords,
} from "@/lib/utils/marketplace-brand-query"
import {
  isMarketplaceBoardStyleOnlyQuery,
  isMarketplaceGenericSurfSearchOnly,
} from "@/lib/utils/marketplace-style-query"
import { listingBoardTypeDbValuesForFilter } from "@/lib/board-type-canonical"
import { listActiveSurfboardIdsWithSearchTags } from "@/lib/db/listings"
import { listingSearchTagSlugsForStyles } from "@/lib/listing-search-tags"
import { isUuidString } from "@/lib/utils/isUuid"
import { hydrateListingsByIds } from "@/lib/search/hydrate-listings"
import {
  listActiveListingIdsByBrandModelIds,
  listActiveListingsForBrand,
} from "@/lib/db/brand-listings"
import { fetchCuratedRecentListings } from "@/lib/db/curatedRecentListings"
import { boardLengthLabelFromDimensionsColumn } from "@/lib/listing-dimensions-storage"
import { coalesceListingImagesForCard } from "@/lib/listing-image-display"
import { resolveDirectoryBrandRowFromLabel } from "@/lib/services/brandDirectorySearch"
import {
  parseMarketplaceQuery,
  type MarketplaceParsedQuery,
} from "@/lib/services/marketplaceQueryParse"
import { expansionsForMarketplaceQuery } from "@/lib/services/searchSynonyms"
import { resolveSearchOverrideListingIds } from "@/lib/services/searchResultOverrides"

export const MARKETPLACE_SEARCH_RESULT_LIMIT = 48

export type MarketplaceSearchBrand = {
  id: string
  name: string
  slug: string
}

export type MarketplaceSearchCategory = {
  id: string
  name: string
  slug: string
  board?: boolean | null
}

export type MarketplaceSearchResolutionMeta = {
  resultCount: number
  backend: "elasticsearch" | "supabase"
}

export type MarketplaceSearchPagePayload = {
  listings: RecentListing[]
  searchMeta: MarketplaceSearchResolutionMeta | null
  brandRow: MarketplaceSearchBrand | null
  brandUnknown: boolean
  brandTypoCorrected: boolean
  parsedQuery: MarketplaceParsedQuery | null
  selectedSlug: string | null
  categorySlugForLog: string | null
  sortedCategories: MarketplaceSearchCategory[]
  modelPageHref: string | null
}

type MarketplaceSearchListingRow = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  compare_at_price?: number | string | null
  is_good_deal?: boolean | null
  condition?: string | null
  section: string
  city?: string | null
  state?: string | null
  shipping_available?: boolean
  board_type?: string | null
  dimensions?: unknown
  primary_image_url?: string | null
  primary_thumbnail_url?: string | null
  tile_gallery_images?: unknown
  profiles?: RecentListing["profiles"]
  categories?: RecentListing["categories"]
}

export function sortMarketplaceBrowseCategories<
  T extends { name: string; board?: boolean | null },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const sa = a.board === true ? 0 : 1
    const sb = b.board === true ? 0 : 1
    if (sa !== sb) return sa - sb
    return a.name.localeCompare(b.name)
  })
}

/**
 * Public marketplace search payload — same for every viewer. Callers must use
 * an anon / service client (no cookies) so the result can be cached.
 */
export async function loadMarketplaceSearchPage(
  supabase: SupabaseClient,
  rawQuery: string,
  brandSlugFromUrl: string,
  categorySlugFromUrl: string,
  categoryRows: MarketplaceSearchCategory[],
): Promise<MarketplaceSearchPagePayload> {
  const brandSlugRequested = brandSlugFromUrl.trim()
  const queryTrimmed = rawQuery.trim()

  let brandFromUrl: MarketplaceSearchBrand | null = null
  if (brandSlugRequested) {
    const { data: brand } = await supabase
      .from("brands")
      .select("id, name, slug")
      .eq("slug", brandSlugRequested)
      .maybeSingle()
    if (brand) {
      brandFromUrl = { id: brand.id, name: brand.name, slug: brand.slug }
    }
  }

  const parsedQuery =
    queryTrimmed.length >= 2
      ? await parseMarketplaceQuery(supabase, queryTrimmed, {
          brandHint: brandFromUrl ? { ...brandFromUrl, logo_url: null } : null,
        })
      : null

  const modelPageHref = marketplaceModelPageHrefFromParsed(parsedQuery)

  let brandRow: MarketplaceSearchBrand | null =
    brandFromUrl ??
    (parsedQuery?.brand
      ? {
          id: parsedQuery.brand.id,
          name: parsedQuery.brand.name,
          slug: parsedQuery.brand.slug,
        }
      : null)

  if (
    !brandRow &&
    queryTrimmed &&
    !parsedQuery?.model &&
    !isMarketplaceSectionOnlyQuery(queryTrimmed) &&
    !isMarketplaceBoardStyleOnlyQuery(queryTrimmed) &&
    !isMarketplaceGenericSurfSearchOnly(queryTrimmed)
  ) {
    brandRow = await resolveDirectoryBrandRowFromLabel(supabase, queryTrimmed)
  }

  const sortedCategories = sortMarketplaceBrowseCategories(categoryRows)
  const requestedSlug = categorySlugFromUrl.trim()
  const matched = requestedSlug
    ? sortedCategories.find((category) => category.slug === requestedSlug)
    : undefined
  const selectedSlug = matched?.slug ?? null
  const categorySlugForLog = matched?.slug ?? null

  const brandUnknown = Boolean(brandSlugRequested && !brandFromUrl)
  const matchedModel = Boolean(parsedQuery?.model || (parsedQuery?.modelIds.length ?? 0) > 0)
  const brandTypoCorrected = Boolean(
    brandRow &&
      queryTrimmed &&
      !matchedModel &&
      Boolean(parsedQuery?.isBrandOnly) &&
      isLikelyTypoBrandMatch(queryTrimmed, brandRow.name),
  )

  const { listings, searchMeta } = await resolveSearchListings(
    supabase,
    queryTrimmed,
    matched ? { id: matched.id, name: matched.name } : null,
    brandUnknown ? null : brandRow,
    parsedQuery,
    Boolean(brandFromUrl),
  )

  return {
    listings,
    searchMeta,
    brandRow,
    brandUnknown,
    brandTypoCorrected,
    parsedQuery,
    selectedSlug,
    categorySlugForLog,
    sortedCategories,
    modelPageHref,
  }
}

async function resolveSearchListings(
  supabase: SupabaseClient,
  rawQuery: string,
  category: { id: string; name: string } | null,
  brand: { id: string; name: string } | null,
  parsed: MarketplaceParsedQuery | null,
  brandFromUrl: boolean,
): Promise<{
  listings: RecentListing[]
  searchMeta: MarketplaceSearchResolutionMeta | null
}> {
  const categoryId = category?.id ?? null

  const useBrandInventory =
    Boolean(brand) &&
    ((!rawQuery.trim() && brandFromUrl) || Boolean(parsed?.isBrandOnly)) &&
    (parsed?.expansions.length ?? 0) === 0

  if (useBrandInventory && brand) {
    const inventorySections = parsed?.sectionIntent ? [parsed.sectionIntent] : undefined
    const listings = await listActiveListingsForBrand(supabase, brand, {
      limit: MARKETPLACE_SEARCH_RESULT_LIMIT,
      categoryId,
      sections: inventorySections,
    })
    if (listings.length > 0) {
      return { listings, searchMeta: null }
    }
    if (!rawQuery.trim()) {
      return { listings, searchMeta: null }
    }
  }

  if (!rawQuery.trim()) {
    const listings = await fetchCuratedRecentListings(
      supabase,
      categoryId,
      MARKETPLACE_SEARCH_RESULT_LIMIT,
    )
    return { listings, searchMeta: null }
  }

  const expansions = [
    ...(parsed?.expansions ?? (await expansionsForMarketplaceQuery(rawQuery))),
    ...(brand ? brandLegacyRecallTokens(brand.name) : []),
  ]
  const widenBrandWithAliases = Boolean(
    parsed?.isBrandOnly && expansions.length > 0 && (parsed.brand?.id || brand?.id),
  )
  const textQuery = widenBrandWithAliases
    ? ""
    : parsed != null
      ? (parsed.textQuery ?? "").trim()
      : rawQuery.trim()
  const brandModelIds =
    parsed?.modelIds?.length
      ? parsed.modelIds
      : parsed?.model?.id
        ? [parsed.model.id]
        : []
  const brandId =
    brandModelIds.length > 0
      ? null
      : parsed?.brand?.id ?? (brandFromUrl ? brand?.id : null) ?? null
  const lengthInches = parsed?.lengthInches ?? null
  const boardTypes = parsed?.styleIntent?.length ? parsed.styleIntent : null
  const sections = categoryId
    ? ["surfboards"]
    : parsed?.sectionIntent
      ? [parsed.sectionIntent]
      : [...ELASTICSEARCH_INDEXED_LISTING_SECTIONS]

  let listings: RecentListing[]
  let backend: MarketplaceSearchResolutionMeta["backend"]

  if (isElasticsearchConfigured()) {
    try {
      const runEs = (opts: {
        q: string
        brandModelIds?: string[] | null
        brandId?: string | null
        lengthInches?: number | null
        boardTypes?: string[] | null
        typoFallback?: boolean
        sections?: string[]
      }) =>
        searchListingIdsFromElasticsearch(opts.q, MARKETPLACE_SEARCH_RESULT_LIMIT, {
          categoryName: category?.name ?? null,
          expansions,
          sections: opts.sections ?? sections,
          brandId: opts.brandId,
          brandModelIds: opts.brandModelIds,
          lengthInches: opts.lengthInches,
          boardTypes: opts.boardTypes,
          typoFallback: opts.typoFallback,
        })

      let ids = await runEs({
        q: textQuery,
        brandModelIds,
        brandId,
        lengthInches,
        boardTypes,
      })
      if (ids.length === 0 && lengthInches != null && brandModelIds.length > 0) {
        ids = await runEs({
          q: textQuery,
          brandModelIds,
          brandId: null,
          lengthInches: null,
          boardTypes,
        })
      }
      if (ids.length === 0 && brandModelIds.length > 0) {
        ids = await runEs({
          q: rawQuery.trim(),
          brandModelIds: null,
          brandId: parsed?.brand?.id ?? brandId,
          lengthInches: null,
          boardTypes,
        })
      }
      if (ids.length === 0) {
        ids = await runEs({
          q: rawQuery.trim(),
          brandModelIds: null,
          brandId: null,
          lengthInches: null,
          boardTypes,
        })
      }
      if (ids.length === 0) {
        ids = await runEs({
          q: textQuery || rawQuery,
          brandModelIds: null,
          brandId: null,
          lengthInches: null,
          boardTypes,
          typoFallback: true,
        })
      }
      if (ids.length === 0 && (parsed?.sectionIntent || (boardTypes?.length ?? 0) > 0)) {
        ids = await runEs({
          q: rawQuery.trim(),
          brandModelIds: null,
          brandId: null,
          lengthInches: null,
          boardTypes: null,
          sections: [...ELASTICSEARCH_INDEXED_LISTING_SECTIONS],
        })
      }
      listings = await hydrateListingsByIds(supabase, ids)
      if (listings.length === 0 && ids.length > 0) {
        ids = await runEs({
          q: rawQuery.trim(),
          brandModelIds: null,
          brandId: null,
          lengthInches: null,
          boardTypes,
        })
        listings = await hydrateListingsByIds(supabase, ids)
      }
      backend = "elasticsearch"
    } catch (err) {
      console.error("[search] Elasticsearch error, falling back to Supabase:", err)
      const fallback = await buildSearchFromSupabase(
        supabase,
        rawQuery,
        categoryId,
        MARKETPLACE_SEARCH_RESULT_LIMIT,
        expansions,
        boardTypes,
      )
      listings = fallback.listings
      backend = "supabase"
    }
  } else {
    const primary = await buildSearchFromSupabase(
      supabase,
      rawQuery,
      categoryId,
      MARKETPLACE_SEARCH_RESULT_LIMIT,
      expansions,
      boardTypes,
    )
    listings = primary.listings
    if (listings.length === 0) {
      const retry = await buildSearchFromSupabaseTypoFallback(
        supabase,
        rawQuery,
        categoryId,
        MARKETPLACE_SEARCH_RESULT_LIMIT,
        boardTypes,
      )
      listings = retry.listings
    }
    backend = "supabase"
  }

  if (listings.length === 0 && brandModelIds.length > 0) {
    const pinnedIds = await listActiveListingIdsByBrandModelIds(supabase, brandModelIds, {
      limit: MARKETPLACE_SEARCH_RESULT_LIMIT,
      sections,
    })
    if (pinnedIds.length > 0) {
      listings = await hydrateListingsByIds(supabase, pinnedIds)
      if (listings.length > 0) backend = "supabase"
    }
  }

  if (listings.length === 0) {
    const overrideIds = await resolveSearchOverrideListingIds(rawQuery)
    if (overrideIds.length > 0) {
      const pinned = await hydrateListingsByIds(supabase, overrideIds)
      if (pinned.length > 0) listings = pinned
    }
  }

  return {
    listings,
    searchMeta: { resultCount: listings.length, backend },
  }
}

function applyBoardTypeFilter<
  T extends {
    in: (column: string, values: string[]) => T
    or: (filters: string) => T
  },
>(query: T, boardTypes: string[] | null, taggedListingIds: string[] = []): T {
  const dbTypes = Array.from(
    new Set((boardTypes ?? []).flatMap((style) => listingBoardTypeDbValuesForFilter(style))),
  )
  const taggedIds = taggedListingIds.filter((id) => isUuidString(id))
  if (dbTypes.length === 0 && taggedIds.length === 0) return query
  if (dbTypes.length > 0 && taggedIds.length === 0) return query.in("board_type", dbTypes)

  const parts: string[] = []
  if (dbTypes.length === 1) parts.push(`board_type.eq.${dbTypes[0]}`)
  else if (dbTypes.length > 1) parts.push(`board_type.in.(${dbTypes.join(",")})`)
  if (taggedIds.length === 1) parts.push(`id.eq.${taggedIds[0]}`)
  else if (taggedIds.length > 1) parts.push(`id.in.(${taggedIds.join(",")})`)
  return query.or(parts.join(","))
}

async function buildSearchFromSupabase(
  supabase: SupabaseClient,
  rawQuery: string,
  categoryId: string | null,
  limit: number,
  expansions: string[] = [],
  boardTypes: string[] | null = null,
): Promise<{ listings: RecentListing[] }> {
  const allRes = await buildSearchQuery(supabase, rawQuery, categoryId, limit, boardTypes)
  let rows = allRes.data

  if (expansions.length > 0) {
    const merged = new Map<string, MarketplaceSearchListingRow>()
    for (const row of rows) merged.set(row.id, row)
    for (const expansion of expansions) {
      if (merged.size >= limit) break
      const expRes = await buildSearchQuery(supabase, expansion, categoryId, limit, boardTypes)
      for (const row of expRes.data) {
        if (!merged.has(row.id)) merged.set(row.id, row)
      }
    }
    rows = Array.from(merged.values()).slice(0, limit)
  }

  return { listings: rows.map((row) => rowToRecentListing(row)) }
}

async function buildSearchFromSupabaseTypoFallback(
  supabase: SupabaseClient,
  rawQuery: string,
  categoryId: string | null,
  limit: number,
  boardTypes: string[] | null = null,
): Promise<{ listings: RecentListing[] }> {
  const meaningful = meaningfulSearchTerms(rawQuery)
  const primary = [...meaningful].sort((a, b) => b.length - a.length)[0]
  if (!primary || primary.length < 4) {
    return { listings: [] }
  }
  const prefix = fuzzyBrandNamePrefix(primary)
  const safe = prefix.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  const pattern = `"%${safe}%"`

  let query = supabase
    .from("listings")
    .select(
      `
      id,
      slug,
      user_id,
      title,
      price,
      compare_at_price,
      is_good_deal,
      condition,
      section,
      city,
      state,
      shipping_available,
      board_type,
      dimensions,
      primary_image_url,
      primary_thumbnail_url,
      tile_gallery_images,
      profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count, shop_verified),
      categories (name, slug)
    `,
    )
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .or(
      `title.ilike.${pattern},description.ilike.${pattern},brand.ilike.${pattern},model.ilike.${pattern}`,
    )
    .order("created_at", { ascending: false })
    .limit(limit)

  if (categoryId) {
    query = query.eq("category_id", categoryId)
  } else {
    query = query.in("section", [...ELASTICSEARCH_INDEXED_LISTING_SECTIONS])
  }
  const taggedIds = await listActiveSurfboardIdsWithSearchTags(
    supabase,
    listingSearchTagSlugsForStyles(boardTypes ?? []),
  )
  query = applyBoardTypeFilter(query, boardTypes, taggedIds)

  const { data, error } = await query
  if (error || !data?.length) return { listings: [] }
  return { listings: data.map((row) => rowToRecentListing(row as MarketplaceSearchListingRow)) }
}

function rowToRecentListing(row: MarketplaceSearchListingRow): RecentListing {
  const boardLength = boardLengthLabelFromDimensionsColumn(
    typeof row.dimensions === "string" ? row.dimensions : null,
  )
  return {
    id: row.id,
    slug: row.slug ?? null,
    user_id: row.user_id,
    title: row.title,
    price: row.price,
    compare_at_price: row.compare_at_price ?? null,
    is_good_deal: row.is_good_deal === true,
    condition: row.condition,
    section: row.section,
    city: row.city,
    state: row.state,
    shipping_available: row.shipping_available,
    board_type: row.board_type,
    board_length: boardLength,
    listing_images: coalesceListingImagesForCard(row),
    profiles: row.profiles,
    categories: row.categories,
  }
}

async function buildSearchQuery(
  supabase: SupabaseClient,
  rawQuery: string,
  categoryId: string | null,
  limit: number,
  boardTypes: string[] | null = null,
): Promise<{ data: MarketplaceSearchListingRow[] }> {
  let query = supabase
    .from("listings")
    .select(
      `
      id,
      slug,
      user_id,
      title,
      price,
      compare_at_price,
      is_good_deal,
      condition,
      section,
      city,
      state,
      shipping_available,
      board_type,
      dimensions,
      primary_image_url,
      primary_thumbnail_url,
      tile_gallery_images,
      profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count, shop_verified),
      categories (name, slug)
    `,
    )
    .eq("status", "active")
    .eq("hidden_from_site", false)

  if (categoryId) {
    query = query.eq("category_id", categoryId)
  } else {
    query = query.in("section", [...ELASTICSEARCH_INDEXED_LISTING_SECTIONS])
  }
  const taggedIds = await listActiveSurfboardIdsWithSearchTags(
    supabase,
    listingSearchTagSlugsForStyles(boardTypes ?? []),
  )
  query = applyBoardTypeFilter(query, boardTypes, taggedIds)

  if (rawQuery) {
    const meaningful = meaningfulSearchTerms(rawQuery)
    if (meaningful.length > 0) {
      for (const term of meaningful) {
        const safe = term.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
        const pattern = `"%${safe}%"`
        query = query.or(
          `title.ilike.${pattern},description.ilike.${pattern},brand.ilike.${pattern},fins_setup.ilike.${pattern},tail_shape.ilike.${pattern}`,
        )
      }
    } else {
      const terms = (stripMarketplaceSearchNoiseWords(rawQuery) || rawQuery)
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean)
      if (terms.length > 0) {
        const orParts: string[] = []
        for (const term of terms) {
          const safe = term.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
          const pattern = `"%${safe}%"`
          orParts.push(`title.ilike.${pattern}`)
          orParts.push(`description.ilike.${pattern}`)
          orParts.push(`brand.ilike.${pattern}`)
          orParts.push(`fins_setup.ilike.${pattern}`)
          orParts.push(`tail_shape.ilike.${pattern}`)
        }
        query = query.or(orParts.join(","))
      }
    }
  }

  query = query.order("created_at", { ascending: false }).limit(limit)
  const { data, error } = await query
  return { data: error ? [] : ((data ?? []) as MarketplaceSearchListingRow[]) }
}
