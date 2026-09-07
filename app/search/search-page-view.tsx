import { Suspense } from "react"
import { after } from "next/server"
import { unstable_cache } from "next/cache"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { SearchCategoryFilters } from "./search-section-filters"
import type { RecentListing } from "@/components/recent-feed-client"
import { RecentFeedClient } from "@/components/recent-feed-client"
import { BoardsNoResultsSaveSearch } from "@/components/boards-no-results-save-search"
import { marketplaceSearchSavedCriteria } from "@/lib/utils/peer-saved-search-criteria"
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
import { hydrateListingsByIds } from "@/lib/search/hydrate-listings"
import {
  listActiveListingIdsByBrandModelIds,
  listActiveListingsForBrand,
} from "@/lib/db/brand-listings"
import { fetchCuratedRecentListings } from "@/lib/db/curatedRecentListings"
import { boardLengthLabelFromDimensionsColumn } from "@/lib/listing-dimensions-storage"
import { resolveDirectoryBrandRowFromLabel } from "@/lib/services/brandDirectorySearch"
import {
  displayMarketplaceSearchQueryForAnalytics,
  normalizeMarketplaceSearchQueryForAnalytics,
  recordMarketplaceSearchAnalyticsEvent,
} from "@/lib/services/searchAnalytics"
import {
  newSearchQualityEventId,
  scheduleSearchQualityEventCapture,
} from "@/lib/services/searchQuality"
import {
  parseMarketplaceQuery,
  type MarketplaceParsedQuery,
} from "@/lib/services/marketplaceQueryParse"
import { expansionsForMarketplaceQuery } from "@/lib/services/searchSynonyms"
import { resolveSearchOverrideListingIds } from "@/lib/services/searchResultOverrides"
import { NaturalLanguageSearchHint } from "@/components/features/search/natural-language-search-hint"

const LIMIT = 48

/** Categories change only when an admin adds/removes one — safe to cache for a full day. */
const getCachedBrowseCategories = unstable_cache(
  async () => {
    // Must not use the cookie-bound client here: cookies() is forbidden
    // inside an unstable_cache scope. Categories are public data anyway.
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from("categories")
      .select("id, name, slug, board")
      .eq("board", true)
    return data ?? []
  },
  ["browse-categories"],
  { revalidate: 60 * 60 * 24, tags: ["browse-categories"] },
)

type MarketplaceSearchResolutionMeta = {
  resultCount: number
  backend: "elasticsearch" | "supabase"
}

function sortMarketplaceBrowseCategories<T extends { name: string; board?: boolean | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const sa = a.board === true ? 0 : 1
    const sb = b.board === true ? 0 : 1
    if (sa !== sb) return sa - sb
    return a.name.localeCompare(b.name)
  })
}

export async function SearchPageView({
  rawQuery,
  brandSlugFromUrl,
  categorySlugFromUrl,
  showSeoBookmark,
  analyticsOriginHeaderNav = false,
  skipAuthLookup = false,
}: {
  rawQuery: string
  /** Raw `?brandSlug=` — must match `public.brands.slug` to apply. */
  brandSlugFromUrl: string
  /** Raw `?category=` segment; must match `categories.slug` to apply. */
  categorySlugFromUrl: string
  /** Shown on the canonical recent-listings URL (`/search/recent`). */
  showSeoBookmark: boolean
  /**
   * True when `/search` was opened from the header nav bar (`nq=1`), used for analytics attribution only.
   */
  analyticsOriginHeaderNav?: boolean
  /**
   * When true, skip `getUser()` and per-user favorites loading so the rendered
   * HTML is user-agnostic and safe to serve from a shared ISR cache.
   * The client component re-hydrates favorites after mount.
   */
  skipAuthLookup?: boolean
}) {
  const brandSlugRequested = brandSlugFromUrl.trim()
  const curatedView = !rawQuery.trim() && !brandSlugRequested

  const supabase = await createClient()

  let brandFromUrl: { id: string; name: string; slug: string } | null = null
  if (brandSlugRequested) {
    const { data: b } = await supabase
      .from("brands")
      .select("id, name, slug")
      .eq("slug", brandSlugRequested)
      .maybeSingle()
    if (b) {
      brandFromUrl = { id: b.id, name: b.name, slug: b.slug }
    }
  }

  const parsedQuery =
    rawQuery.trim().length >= 2
      ? await parseMarketplaceQuery(supabase, rawQuery, {
          brandHint: brandFromUrl
            ? { ...brandFromUrl, logo_url: null }
            : null,
        })
      : null

  let brandRow: { id: string; name: string; slug: string } | null =
    brandFromUrl ??
    (parsedQuery?.brand
      ? {
          id: parsedQuery.brand.id,
          name: parsedQuery.brand.name,
          slug: parsedQuery.brand.slug,
        }
      : null)

  // Brand-only free-text still resolves via directory when the parser misses.
  // Skip for bare section keywords ("fins") and shape / fin-layout queries
  // ("fish", "fish twin") — those must not match Futures Fins / Fish Stix, etc.
  if (
    !brandRow &&
    rawQuery.trim() &&
    !parsedQuery?.model &&
    !isMarketplaceSectionOnlyQuery(rawQuery) &&
    !isMarketplaceBoardStyleOnlyQuery(rawQuery) &&
    !isMarketplaceGenericSurfSearchOnly(rawQuery)
  ) {
    brandRow = await resolveDirectoryBrandRowFromLabel(supabase, rawQuery)
  }

  const [{ data: { user } }, categoryRows] = await Promise.all([
    // When skipAuthLookup is set, the page is cached by ISR so we must not
    // bake per-user state into the HTML. Skip the auth round-trip entirely.
    skipAuthLookup
      ? Promise.resolve({ data: { user: null } })
      : supabase.auth.getUser(),
    getCachedBrowseCategories(),
  ])

  const sortedCategories = sortMarketplaceBrowseCategories(categoryRows)
  const requestedSlug = categorySlugFromUrl.trim()
  const matched = requestedSlug
    ? sortedCategories.find((c) => c.slug === requestedSlug)
    : undefined
  const selectedSlug = matched?.slug ?? null
  const categorySlugForLog = matched?.slug ?? null

  const brandUnknown = Boolean(brandSlugRequested && !brandFromUrl)
  const matchedModel = Boolean(parsedQuery?.model || (parsedQuery?.modelIds.length ?? 0) > 0)
  // Only show "closest brand" when we corrected a brand typo — not when a model implied the brand.
  const brandTypoCorrected = Boolean(
    brandRow &&
      rawQuery.trim() &&
      !matchedModel &&
      Boolean(parsedQuery?.isBrandOnly) &&
      isLikelyTypoBrandMatch(rawQuery, brandRow.name),
  )

  const { listings, searchMeta } = await resolveSearchListings(
    supabase,
    rawQuery,
    matched ? { id: matched.id, name: matched.name } : null,
    brandUnknown ? null : brandRow,
    parsedQuery,
    Boolean(brandFromUrl),
  )

  if (rawQuery.trim()) {
    if (searchMeta) {
      const analyticsPayload = {
        queryDisplay: displayMarketplaceSearchQueryForAnalytics(rawQuery),
        queryNormalized: normalizeMarketplaceSearchQueryForAnalytics(rawQuery),
        resultCount: searchMeta.resultCount,
        backend: searchMeta.backend,
        categorySlug: categorySlugForLog,
        ...(analyticsOriginHeaderNav ? { originSurface: "header_nav" as const } : {}),
      }
      after(async () => {
        try {
          await recordMarketplaceSearchAnalyticsEvent(analyticsPayload)
        } catch (e) {
          console.error("[SearchPageView] marketplace search analytics failed:", e)
        }
      })
    }
    scheduleSearchQualityEventCapture({
      eventId: newSearchQualityEventId(),
      rawQuery,
      searchSurface: "marketplace",
      backend: searchMeta?.backend ?? null,
      listings: listings.map((l) => ({
        id: l.id,
        title: l.title,
        slug: l.slug,
        price: l.price,
        board_type: l.board_type,
        listing_images: l.listing_images,
      })),
      parsed: parsedQuery,
    })
  }

  let favoritedListingIds: string[] = []
  if (user) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
    favoritedListingIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
    <main className="flex-1">
      <section className="border-b bg-background">
        <div className="container mx-auto py-6 md:py-8">
          <h1 className="text-xl font-bold text-foreground md:text-2xl">
            {brandUnknown ? (
              <>Brand not found</>
            ) : matchedModel && rawQuery.trim() ? (
              <>
                Results for &ldquo;{rawQuery}&rdquo;
                {parsedQuery?.model ? (
                  <>
                    {" "}
                    — {parsedQuery.model.name}
                    {brandRow ? ` · ${brandRow.name}` : null}
                  </>
                ) : brandRow ? (
                  <> — {brandRow.name}</>
                ) : null}
              </>
            ) : brandRow ? (
              <>
                {rawQuery.trim() ? (
                  <>Results for &ldquo;{rawQuery}&rdquo; — {brandRow.name}</>
                ) : (
                  <>Listings — {brandRow.name}</>
                )}
              </>
            ) : rawQuery ? (
              <>Results for &ldquo;{rawQuery}&rdquo;</>
            ) : (
              <>Recently listed for you</>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {brandUnknown ? (
              <>Check the spelling or search from the header — that slug is not in our brand directory.</>
            ) : parsedQuery?.model && rawQuery.trim() ? (
              <>
                Matching catalog model
                {parsedQuery?.lengthToken ? <> · length {parsedQuery.lengthToken}</> : null}
                . For filters (style, price, shipping),{" "}
                <a
                  href={`/boards?q=${encodeURIComponent(rawQuery.trim())}${
                    parsedQuery?.model?.id
                      ? `&brandModelId=${encodeURIComponent(parsedQuery.model.id)}`
                      : ""
                  }${
                    parsedQuery?.lengthToken
                      ? `&dimLength=${encodeURIComponent(parsedQuery.lengthToken)}`
                      : ""
                  }`}
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  browse with facets
                </a>
                .
              </>
            ) : brandRow ? (
              <>
                {brandTypoCorrected ? (
                  <>
                    No exact match for &ldquo;{rawQuery}&rdquo; — showing listings for{" "}
                    <span className="font-medium text-foreground">{brandRow.name}</span>, the closest brand
                    in our directory.
                  </>
                ) : (
                  <>
                    Active marketplace listings for this brand
                    {rawQuery.trim() ? " (matched from your search)" : ""} — including listings linked by
                    brand directory and legacy title text.
                  </>
                )}
              </>
            ) : rawQuery ? (
              <>Use the search bar in the header to refine results.</>
            ) : (
              <>
                A curated mix of new listings, favoring active sellers, then freshest posts. Use the
                header search to look up listings.
                {showSeoBookmark && (
                  <span className="mt-1 block text-xs text-muted-foreground/80">
                    Bookmark this page —{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[11px]">/search/recent</code>
                  </span>
                )}
              </>
            )}
          </p>
          {rawQuery.trim() ? (
            <div className="mt-4 max-w-2xl">
              <NaturalLanguageSearchHint query={rawQuery} />
            </div>
          ) : null}
        </div>
      </section>

      <Suspense fallback={null}>
        <SearchCategoryFilters
          query={rawQuery}
          selectedSlug={selectedSlug}
          categories={sortedCategories}
          curated={curatedView}
          brandSlug={brandRow?.slug ?? (brandSlugRequested || null)}
          brandFilterName={brandRow?.name ?? null}
          brandUnknown={brandUnknown}
        />
      </Suspense>

      <section className="container mx-auto py-8">
        {listings.length === 0 && rawQuery.trim() && !brandUnknown ? (
          <BoardsNoResultsSaveSearch
            criteria={marketplaceSearchSavedCriteria(rawQuery)}
            isLoggedIn={!!user}
            clearHref="/search/recent"
          />
        ) : (
          <RecentFeedClient
            listings={listings}
            favoritedListingIds={favoritedListingIds}
            isLoggedIn={!!user}
            viewerUserId={user?.id ?? null}
            hydrateOwnFavorites={skipAuthLookup}
            emptyMessage={
              brandUnknown
                ? "No brand matches that URL. Return to search and pick a brand from suggestions."
                : brandRow
                  ? "No active listings for this brand yet. Try another category or check back soon."
                  : "No listings to show yet. Check back soon or browse by category."
            }
          />
        )}
      </section>
    </main>
  )
}

async function resolveSearchListings(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

  // Brand inventory only for brand-only intent (URL brand with no q, or parsed brand-only).
  // Skip exclusive inventory when synonyms exist (Lost ↔ Mayhem) so alias titles recall too.
  const useBrandInventory =
    Boolean(brand) &&
    ((!rawQuery.trim() && brandFromUrl) || Boolean(parsed?.isBrandOnly)) &&
    (parsed?.expansions.length ?? 0) === 0

  if (useBrandInventory && brand) {
    const inventorySections = parsed?.sectionIntent ? [parsed.sectionIntent] : undefined
    const listings = await listActiveListingsForBrand(supabase, brand, {
      limit: LIMIT,
      categoryId,
      sections: inventorySections,
    })
    if (listings.length > 0) {
      return { listings, searchMeta: null }
    }
    // Empty inventory with no typed query (brandSlug URL / brand page) stays empty.
    // Brand-only free text must fall through so last-name titles still recall
    // (e.g. "Christenson" → "6'6 Christenson Lane Splitter"). Section-scoped
    // inventory can also be empty for co-brands (CI query → Futures fins).
    if (!rawQuery.trim()) {
      return { listings, searchMeta: null }
    }
  }

  if (!rawQuery.trim()) {
    const listings = await fetchCuratedRecentListings(supabase, categoryId, LIMIT)
    return { listings, searchMeta: null }
  }

  const expansions = [
    ...(parsed?.expansions ?? (await expansionsForMarketplaceQuery(rawQuery))),
    ...(brand ? brandLegacyRecallTokens(brand.name) : []),
  ]
  // Prefer parser text (may be "" for section-only "fins" → all listings in that section).
  // Brand-only + aliases: empty keyword so brand_id OR alias text is the recall clause.
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
      }) =>
        searchListingIdsFromElasticsearch(opts.q, LIMIT, {
          categoryName: category?.name ?? null,
          expansions,
          sections,
          brandId: opts.brandId,
          brandModelIds: opts.brandModelIds,
          lengthInches: opts.lengthInches,
          boardTypes: opts.boardTypes,
          typoFallback: opts.typoFallback,
        })

      // Progressive relaxation: model+length → model only → text (+ brand) → typo.
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
      listings = await hydrateListingsByIds(supabase, ids)
      // Stale ES hits (deleted/hidden) skip relaxation because ids.length > 0.
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

function applyBoardTypeFilter<T extends { in: (column: string, values: string[]) => T }>(
  query: T,
  boardTypes: string[] | null,
): T {
  const dbTypes = Array.from(
    new Set((boardTypes ?? []).flatMap((s) => listingBoardTypeDbValuesForFilter(s))),
  )
  if (dbTypes.length === 0) return query
  return query.in("board_type", dbTypes)
}

async function buildSearchFromSupabase(
  supabase: Awaited<ReturnType<typeof createClient>>,
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
  supabase: Awaited<ReturnType<typeof createClient>>,
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
      condition,
      section,
      city,
      state,
      shipping_available,
      board_type,
      dimensions,
      listing_images (url, is_primary),
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
  query = applyBoardTypeFilter(query, boardTypes)

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
    condition: row.condition,
    section: row.section,
    city: row.city,
    state: row.state,
    shipping_available: row.shipping_available,
    board_type: row.board_type,
    board_length: boardLength,
    listing_images: row.listing_images,
    profiles: row.profiles,
    categories: row.categories,
  }
}

async function buildSearchQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
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
      condition,
      section,
      city,
      state,
      shipping_available,
      board_type,
      dimensions,
      listing_images (url, is_primary),
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
  query = applyBoardTypeFilter(query, boardTypes)

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
