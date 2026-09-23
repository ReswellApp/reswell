import { Suspense, type ReactNode } from "react"
import { after } from "next/server"
import { unstable_cache } from "next/cache"
import { redirect } from "next/navigation"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getDb } from "@/lib/supabase/db"
import { createClient } from "@/lib/supabase/server"
import {
  MARKETPLACE_SEARCH_PAGE_CACHE_TAG,
  MARKETPLACE_SEARCH_PAGE_REVALIDATE_SECONDS,
} from "@/lib/cache/marketplace-search-page"
import { marketplaceModelPageHrefFromParsed } from "@/lib/models/search-redirect"
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
import {
  listingCoverImageForCard,
  listingImagesFromPrimaryFields,
} from "@/lib/listing-image-display"
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
const LIMIT = 48

/** Categories change only when an admin adds/removes one — safe to cache for a full day. */
const getCachedBrowseCategories = unstable_cache(
  async () => {
    // Must not use the cookie-bound client here: cookies() is forbidden
    // inside an unstable_cache scope. Categories are public data anyway.
    const supabase = getDb({ consistency: "eventual", purpose: "analytics" })
    const { data } = await supabase
      .from("categories")
      .select("id, name, slug, board")
      .eq("board", true)
    return data ?? []
  },
  ["browse-categories"],
  { revalidate: 60 * 60 * 24, tags: ["browse-categories"] },
)

type SearchBrandRow = { id: string; name: string; slug: string }

type MarketplaceSearchIntent = {
  brandFromUrl: SearchBrandRow | null
  parsedQuery: MarketplaceParsedQuery | null
  brandRow: SearchBrandRow | null
}

type MarketplaceSearchListingsCache = {
  listings: RecentListing[]
  searchMeta: MarketplaceSearchResolutionMeta | null
}

function toSearchBrandRow(
  row: { id: string; name: string; slug: string } | null,
): SearchBrandRow | null {
  if (!row) return null
  return { id: row.id, name: row.name, slug: row.slug }
}

/**
 * Brand lookup, query parse, and directory fallback. Keyed by the normalized
 * query so "Lost" and "lost" share one entry. Must not touch cookies.
 */
async function loadMarketplaceSearchIntent(
  queryNormalized: string,
  brandSlug: string,
): Promise<MarketplaceSearchIntent> {
  const supabase = getDb({ consistency: "eventual" })
  const brandSlugRequested = brandSlug.trim()

  let brandFromUrl: SearchBrandRow | null = null
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
    queryNormalized.length >= 2
      ? await parseMarketplaceQuery(supabase, queryNormalized, {
          brandHint: brandFromUrl ? { ...brandFromUrl, logo_url: null } : null,
        })
      : null

  let brandRow: SearchBrandRow | null =
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
    queryNormalized &&
    !parsedQuery?.model &&
    !isMarketplaceSectionOnlyQuery(queryNormalized) &&
    !isMarketplaceBoardStyleOnlyQuery(queryNormalized) &&
    !isMarketplaceGenericSurfSearchOnly(queryNormalized)
  ) {
    const directory = await resolveDirectoryBrandRowFromLabel(supabase, queryNormalized)
    brandRow = toSearchBrandRow(directory)
  }

  return { brandFromUrl, parsedQuery, brandRow }
}

const getCachedMarketplaceSearchIntent = unstable_cache(
  loadMarketplaceSearchIntent,
  ["marketplace-search-intent"],
  {
    revalidate: MARKETPLACE_SEARCH_PAGE_REVALIDATE_SECONDS,
    tags: [MARKETPLACE_SEARCH_PAGE_CACHE_TAG],
  },
)

async function getMarketplaceSearchIntentCached(
  queryNormalized: string,
  brandSlug: string,
): Promise<MarketplaceSearchIntent> {
  if (process.env.NODE_ENV === "development") {
    return loadMarketplaceSearchIntent(queryNormalized, brandSlug)
  }
  return getCachedMarketplaceSearchIntent(queryNormalized, brandSlug)
}

async function loadMarketplaceSearchListings(
  queryNormalized: string,
  categoryId: string,
  categoryName: string,
  brandId: string,
  brandName: string,
  brandFromUrlFlag: string,
  parsedQueryJson: string,
): Promise<MarketplaceSearchListingsCache> {
  const supabase = getDb({ consistency: "eventual" })
  const parsedQuery: MarketplaceParsedQuery | null = parsedQueryJson
    ? (JSON.parse(parsedQueryJson) as MarketplaceParsedQuery)
    : null
  const brand = brandId ? { id: brandId, name: brandName } : null
  const category = categoryId ? { id: categoryId, name: categoryName } : null
  return resolveSearchListings(
    supabase,
    queryNormalized,
    category,
    brand,
    parsedQuery,
    brandFromUrlFlag === "1",
  )
}

const getCachedMarketplaceSearchListings = unstable_cache(
  loadMarketplaceSearchListings,
  ["marketplace-search-listings"],
  {
    revalidate: MARKETPLACE_SEARCH_PAGE_REVALIDATE_SECONDS,
    tags: [MARKETPLACE_SEARCH_PAGE_CACHE_TAG],
  },
)

async function getMarketplaceSearchListingsCached(
  queryNormalized: string,
  categoryId: string,
  categoryName: string,
  brand: SearchBrandRow | null,
  brandFromUrl: boolean,
  parsedQuery: MarketplaceParsedQuery | null,
): Promise<MarketplaceSearchListingsCache> {
  const args = [
    queryNormalized,
    categoryId,
    categoryName,
    brand?.id ?? "",
    brand?.name ?? "",
    brandFromUrl ? "1" : "0",
    parsedQuery ? JSON.stringify(parsedQuery) : "",
  ] as const
  if (process.env.NODE_ENV === "development") {
    return loadMarketplaceSearchListings(...args)
  }
  return getCachedMarketplaceSearchListings(...args)
}

async function loadSearchPageUser(): Promise<{ id: string } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? { id: user.id } : null
}

async function loadFavoritedListingIds(userId: string, listingIds: string[]): Promise<string[]> {
  if (listingIds.length === 0) return []
  const supabase = await createClient()
  const matched: string[] = []
  for (let index = 0; index < listingIds.length; index += 80) {
    const chunk = listingIds.slice(index, index + 80)
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", userId)
      .in("listing_id", chunk)
    for (const row of favs ?? []) matched.push(row.listing_id)
  }
  return matched
}

type MarketplaceSearchResolutionMeta = {
  resultCount: number
  backend: "elasticsearch" | "supabase"
}

function searchResultsHeading({
  brandUnknown,
  query,
  brandName,
  modelName,
  lengthToken,
  brandTypoCorrected,
  browseFacetsHref,
}: {
  brandUnknown: boolean
  query: string
  brandName: string | null
  modelName: string | null
  lengthToken: string | null
  brandTypoCorrected: boolean
  browseFacetsHref: string | null
}): { title: ReactNode; subtitle: ReactNode } {
  if (brandUnknown) {
    return {
      title: "Brand not found",
      subtitle: "Check the spelling or try another search.",
    }
  }

  if (query) {
    const title = <>Results for &ldquo;{query}&rdquo;</>
    if (brandTypoCorrected && brandName) {
      return {
        title,
        subtitle: (
          <>
            Showing closest match: <span className="font-medium text-foreground">{brandName}</span>
          </>
        ),
      }
    }
    if (modelName) {
      const detail = [modelName, brandName, lengthToken].filter(Boolean).join(" · ")
      return {
        title,
        subtitle: (
          <>
            {detail}
            {browseFacetsHref ? (
              <>
                {" · "}
                <a
                  href={browseFacetsHref}
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  More filters
                </a>
              </>
            ) : null}
          </>
        ),
      }
    }
    if (brandName) {
      return { title, subtitle: brandName }
    }
    return { title, subtitle: null }
  }

  if (brandName) {
    return { title: brandName, subtitle: null }
  }

  return { title: "Recently listed", subtitle: null }
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
  analyticsOriginHeaderNav = false,
  skipAuthLookup = false,
}: {
  rawQuery: string
  /** Raw `?brandSlug=` — must match `public.brands.slug` to apply. */
  brandSlugFromUrl: string
  /** Raw `?category=` segment; must match `categories.slug` to apply. */
  categorySlugFromUrl: string
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
  const queryNormalized = normalizeMarketplaceSearchQueryForAnalytics(rawQuery)

  const intent = await getMarketplaceSearchIntentCached(queryNormalized, brandSlugRequested)
  const { brandFromUrl, parsedQuery, brandRow } = intent

  if (!categorySlugFromUrl.trim()) {
    const modelPageHref = marketplaceModelPageHrefFromParsed(parsedQuery)
    if (modelPageHref) redirect(modelPageHref)
  }

  // Session read stays off the cached path. Hearts hydrate in the browser.
  const userPromise = skipAuthLookup ? Promise.resolve(null) : loadSearchPageUser()

  const categoryRows = await getCachedBrowseCategories()

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

  const [{ listings, searchMeta }, user] = await Promise.all([
    getMarketplaceSearchListingsCached(
      queryNormalized,
      matched?.id ?? "",
      matched?.name ?? "",
      brandUnknown ? null : brandRow,
      Boolean(brandFromUrl),
      parsedQuery,
    ),
    userPromise,
  ])

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

  const favoritedListingIds = user
    ? await loadFavoritedListingIds(
        user.id,
        listings.map((listing) => listing.id),
      )
    : []

  const queryTrimmed = rawQuery.trim()
  const heading = searchResultsHeading({
    brandUnknown,
    query: queryTrimmed,
    brandName: brandRow?.name ?? null,
    modelName: parsedQuery?.model?.name ?? null,
    lengthToken: parsedQuery?.lengthToken ?? null,
    brandTypoCorrected,
    browseFacetsHref:
      parsedQuery?.model && queryTrimmed
        ? `/boards?q=${encodeURIComponent(queryTrimmed)}${
            parsedQuery.model.id
              ? `&brandModelId=${encodeURIComponent(parsedQuery.model.id)}`
              : ""
          }${
            parsedQuery.lengthToken
              ? `&dimLength=${encodeURIComponent(parsedQuery.lengthToken)}`
              : ""
          }`
        : null,
  })

  return (
    <main className="flex-1">
      <section className="border-b bg-background">
        <div className="container mx-auto flex flex-col gap-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 md:py-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{heading.title}</h1>
            {heading.subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground">{heading.subtitle}</p>
            ) : null}
          </div>
          <Suspense fallback={null}>
            <SearchCategoryFilters
              query={rawQuery}
              selectedSlug={selectedSlug}
              categories={sortedCategories}
              brandSlug={brandRow?.slug ?? (brandSlugRequested || null)}
            />
          </Suspense>
        </div>
      </section>

      <section className="container mx-auto py-8">
        {listings.length === 0 && rawQuery.trim() && !brandUnknown ? (
          <BoardsNoResultsSaveSearch
            criteria={marketplaceSearchSavedCriteria(rawQuery)}
            isLoggedIn={!!user}
            hydrateSession={skipAuthLookup}
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
        sections?: string[]
      }) =>
        searchListingIdsFromElasticsearch(opts.q, LIMIT, {
          categoryName: category?.name ?? null,
          expansions,
          sections: opts.sections ?? sections,
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
      // Last recall pass: drop inferred section / style filters (e.g. "captain fin"
      // must not stay locked to `fins` when the boards live in another section).
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
