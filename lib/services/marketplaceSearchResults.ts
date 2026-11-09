import type { SupabaseClient } from "@supabase/supabase-js"
import type { RecentListing } from "@/components/recent-feed-client"
import { listingBoardTypeDbValuesForFilter } from "@/lib/board-type-canonical"
import { listActiveSurfboardIdsWithSearchTags } from "@/lib/db/listings"
import {
  listActiveListingIdsByBrandModelIds,
  listActiveListingsForBrand,
} from "@/lib/db/brand-listings"
import { fetchCuratedRecentListings } from "@/lib/db/curatedRecentListings"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { ELASTICSEARCH_INDEXED_LISTING_SECTIONS } from "@/lib/elasticsearch/listing-sections"
import {
  meaningfulSearchTerms,
  searchListingIdsFromElasticsearch,
} from "@/lib/elasticsearch/listings-index"
import { listingSearchTagSlugsForStyles } from "@/lib/listing-search-tags"
import { boardLengthLabelFromDimensionsColumn } from "@/lib/listing-dimensions-storage"
import {
  listingCoverImageForCard,
  listingImagesFromPrimaryFields,
} from "@/lib/listing-image-display"
import { hydrateListingsByIds } from "@/lib/search/hydrate-listings"
import { expansionsForMarketplaceQuery } from "@/lib/services/searchSynonyms"
import {
  buildMarketplaceSearchPlan,
  type MarketplaceSearchEsPass,
} from "@/lib/services/marketplaceSearchPlan"
import { resolveSearchOverrideListingIds } from "@/lib/services/searchResultOverrides"
import type { MarketplaceParsedQuery } from "@/lib/services/marketplaceQueryParse"
import {
  fuzzyBrandNamePrefix,
  stripMarketplaceSearchNoiseWords,
} from "@/lib/utils/marketplace-brand-query"
import { isUuidString } from "@/lib/utils/isUuid"

const LIMIT = 48

type MarketplaceSearchResolutionMeta = {
  resultCount: number
  backend: "elasticsearch" | "supabase"
}

export async function resolveSearchListings(
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
  const fallbackExpansions =
    parsed != null ? [] : await expansionsForMarketplaceQuery(rawQuery)
  const plan = buildMarketplaceSearchPlan({
    rawQuery,
    parsed,
    brand,
    brandFromUrl,
    categoryId,
    fallbackExpansions,
  })

  // Brand inventory only for brand-only intent (URL brand with no q, or parsed brand-only).
  // Skip exclusive inventory when synonyms exist (Lost ↔ Mayhem) so alias titles recall too.
  if (plan.useBrandInventory && brand) {
    const listings = await listActiveListingsForBrand(supabase, brand, {
      limit: LIMIT,
      categoryId,
      sections: plan.inventorySections,
    })
    if (listings.length > 0) {
      return { listings, searchMeta: null }
    }
    // Empty inventory with no typed query (brandSlug URL / brand page) stays empty.
    // Brand-only free text must fall through so last-name titles still recall
    // (e.g. "Christenson" → "6'6 Christenson Lane Splitter"). Section-scoped
    // inventory can also be empty for co-brands (CI query → Futures fins).
    if (plan.inventoryIsFinal) {
      return { listings, searchMeta: null }
    }
  }

  if (!rawQuery.trim()) {
    const listings = await fetchCuratedRecentListings(supabase, categoryId, LIMIT)
    return { listings, searchMeta: null }
  }

  const { expansions, brandModelIds, boardTypes, sections } = plan

  let listings: RecentListing[]
  let backend: MarketplaceSearchResolutionMeta["backend"]

  if (isElasticsearchConfigured()) {
    try {
      const runEs = (pass: MarketplaceSearchEsPass) =>
        searchListingIdsFromElasticsearch(pass.q, LIMIT, {
          categoryName: category?.name ?? null,
          expansions,
          sections: pass.sections,
          brandId: pass.brandId,
          brandModelIds: pass.brandModelIds,
          lengthInches: pass.lengthInches,
          boardTypes: pass.boardTypes,
          typoFallback: pass.typoFallback,
        })

      // Same order as saved-search alerts: stop at the first pass that has rows.
      let ids: string[] = []
      for (const pass of plan.esPasses) {
        ids = await runEs(pass)
        if (ids.length > 0) break
      }
      listings = await hydrateListingsByIds(supabase, ids)
      // Stale ES hits (deleted/hidden) skip relaxation because ids.length > 0.
      if (listings.length === 0 && ids.length > 0) {
        ids = await runEs({
          q: rawQuery.trim(),
          brandModelIds: null,
          brandId: null,
          lengthInches: null,
          boardTypes,
          sections,
          typoFallback: false,
        })
        listings = await hydrateListingsByIds(supabase, ids)
      }
      backend = "elasticsearch"
    } catch (err) {
      console.error("[search] Elasticsearch error, falling back to Supabase:", err)
      const r = await buildSearchFromSupabase(
        supabase,
        rawQuery,
        categoryId,
        LIMIT,
        expansions,
        boardTypes,
      )
      listings = r.listings
      backend = "supabase"
    }
  } else {
    const r = await buildSearchFromSupabase(
      supabase,
      rawQuery,
      categoryId,
      LIMIT,
      expansions,
      boardTypes,
    )
    listings = r.listings
    if (listings.length === 0) {
      const retry = await buildSearchFromSupabaseTypoFallback(
        supabase,
        rawQuery,
        categoryId,
        LIMIT,
        boardTypes,
      )
      listings = retry.listings
    }
    backend = "supabase"
  }

  // Same recall path as nav typeahead: listings linked to the matched catalog models.
  if (listings.length === 0 && brandModelIds.length > 0) {
    const pinnedIds = await listActiveListingIdsByBrandModelIds(supabase, brandModelIds, {
      limit: LIMIT,
      sections,
    })
    if (pinnedIds.length > 0) {
      listings = await hydrateListingsByIds(supabase, pinnedIds)
      if (listings.length > 0) backend = "supabase"
    }
  }

  // Final safety net: admin-pinned listings for queries that still found nothing.
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
    new Set((boardTypes ?? []).flatMap((s) => listingBoardTypeDbValuesForFilter(s))),
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
): Promise<{
  listings: RecentListing[]
}> {
  const allRes = await buildSearchQuery(supabase, rawQuery, categoryId, limit, boardTypes)
  let rows = allRes.data ?? []

  // Synonym expansions are OR-added (same as ES) so Lost also retrieves Mayhem, etc.
  if (expansions.length > 0) {
    const merged = new Map<string, (typeof rows)[number]>()
    for (const row of rows) merged.set(row.id, row)
    for (const expansion of expansions) {
      if (merged.size >= limit) break
      const expRes = await buildSearchQuery(supabase, expansion, categoryId, limit, boardTypes)
      for (const row of expRes.data ?? []) {
        if (!merged.has(row.id)) merged.set(row.id, row)
      }
    }
    rows = Array.from(merged.values()).slice(0, limit)
  }

  const listings = rows.map((row: any) => rowToRecentListing(row))

  return {
    listings,
  }
}

/** Supabase fallback when strict listing text match returns nothing (prefix on strongest token). */
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
  return { listings: data.map((row: any) => rowToRecentListing(row)) }
}

function rowToRecentListing(row: any): RecentListing {
  const boardLength = boardLengthLabelFromDimensionsColumn(row.dimensions) ?? null
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
    listing_images: listingCoverImageForCard(
      listingImagesFromPrimaryFields(row.primary_image_url, row.primary_thumbnail_url),
    ),
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
): Promise<{ data: any[] }> {
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
        .map((t) => t.trim())
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
  return { data: error ? [] : (data ?? []) }
}
