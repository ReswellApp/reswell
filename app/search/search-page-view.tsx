import { Suspense, type ReactNode } from "react"
import { after } from "next/server"
import { unstable_cache } from "next/cache"
import { redirect } from "next/navigation"
import { getDb } from "@/lib/supabase/db"
import { createClient } from "@/lib/supabase/server"
import { marketplaceModelPageHrefFromParsed } from "@/lib/models/search-redirect"
import { SearchResultsFilterButton } from "@/components/features/search/search-results-filter-button"
import { searchResultsFilterHref } from "@/lib/utils/search-results-filter-href"
import { SearchCategoryFilters } from "./search-section-filters"
import type { RecentListing } from "@/components/recent-feed-client"
import { RecentFeedClient } from "@/components/recent-feed-client"
import { BoardsNoResultsSaveSearch } from "@/components/boards-no-results-save-search"
import { marketplaceSearchSavedCriteria } from "@/lib/utils/peer-saved-search-criteria"
import { matchingSavedSearchId } from "@/lib/utils/saved-search-criteria-equal"
import { fetchBoardSavedSearchesForUser } from "@/lib/db/savedSearches"
import { BOARD_SAVED_SEARCHES_MAX } from "@/lib/validations/boardSavedSearch"
import { listingCardImageSrc } from "@/lib/listing-image-display"
import { resolveDirectoryBrandRowFromLabel } from "@/lib/services/brandDirectorySearch"
import { resolveSearchListings } from "@/lib/services/marketplaceSearchResults"
import {
  isLikelyTypoBrandMatch,
  isMarketplaceSectionOnlyQuery,
} from "@/lib/utils/marketplace-brand-query"
import {
  isMarketplaceBoardStyleOnlyQuery,
  isMarketplaceGenericSurfSearchOnly,
} from "@/lib/utils/marketplace-style-query"
import {
  displayMarketplaceSearchQueryForAnalytics,
  normalizeMarketplaceSearchQueryForAnalytics,
  recordMarketplaceSearchAnalyticsEvent,
} from "@/lib/services/searchAnalytics"
import {
  newSearchQualityEventId,
  scheduleSearchQualityEventCapture,
} from "@/lib/services/searchQuality"
import { parseMarketplaceQuery } from "@/lib/services/marketplaceQueryParse"

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

function searchResultsHeading({
  brandUnknown,
  query,
  brandName,
  modelName,
  lengthToken,
  brandTypoCorrected,
}: {
  brandUnknown: boolean
  query: string
  brandName: string | null
  modelName: string | null
  lengthToken: string | null
  brandTypoCorrected: boolean
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
      return { title, subtitle: detail }
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

export async function getSearchShareListing({
  rawQuery,
  brandSlugFromUrl,
  categorySlugFromUrl,
}: {
  rawQuery: string
  brandSlugFromUrl: string
  categorySlugFromUrl: string
}): Promise<RecentListing | null> {
  const supabase = await createClient()
  const brandSlugRequested = brandSlugFromUrl.trim()

  let brandFromUrl: { id: string; name: string; slug: string } | null = null
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
    rawQuery.trim().length >= 2
      ? await parseMarketplaceQuery(supabase, rawQuery, {
          brandHint: brandFromUrl ? { ...brandFromUrl, logo_url: null } : null,
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

  const sortedCategories = sortMarketplaceBrowseCategories(await getCachedBrowseCategories())
  const matchedCategory = categorySlugFromUrl.trim()
    ? sortedCategories.find((category) => category.slug === categorySlugFromUrl.trim())
    : undefined
  const categoryFilter = rawQuery.trim()
    ? null
    : matchedCategory
      ? { id: matchedCategory.id, name: matchedCategory.name }
      : null
  const brandUnknown = Boolean(brandSlugRequested && !brandFromUrl)
  const { listings } = await resolveSearchListings(
    supabase,
    rawQuery,
    categoryFilter,
    brandUnknown ? null : brandRow,
    parsedQuery,
    Boolean(brandFromUrl),
  )

  return listings.find((listing) => Boolean(listingCardImageSrc(listing.listing_images))) ?? null
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

  if (!categorySlugFromUrl.trim()) {
    const modelPageHref = marketplaceModelPageHrefFromParsed(parsedQuery)
    if (modelPageHref) redirect(modelPageHref)
  }

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
  // A typed search already states what the shopper wants. The board-type menu
  // beside the results heading narrows that query without saying so, so it
  // only applies on browse (recent listings, brand inventory).
  const categoryFilter = rawQuery.trim()
    ? null
    : matched
      ? { id: matched.id, name: matched.name }
      : null
  const categorySlugForLog = categoryFilter ? (matched?.slug ?? null) : null

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
    categoryFilter,
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

  const queryTrimmed = rawQuery.trim()
  const savedSearchCriteria = queryTrimmed ? marketplaceSearchSavedCriteria(queryTrimmed) : null
  let savedSearchId: string | null = null
  if (user && savedSearchCriteria && !brandUnknown) {
    const { data: savedRows } = await fetchBoardSavedSearchesForUser(
      supabase,
      user.id,
      BOARD_SAVED_SEARCHES_MAX,
    )
    savedSearchId = matchingSavedSearchId(savedRows, savedSearchCriteria)
  }
  const heading = searchResultsHeading({
    brandUnknown,
    query: queryTrimmed,
    brandName: brandRow?.name ?? null,
    modelName: parsedQuery?.model?.name ?? null,
    lengthToken: parsedQuery?.lengthToken ?? null,
    brandTypoCorrected,
  })
  const filtersHref = queryTrimmed
    ? searchResultsFilterHref({
        query: queryTrimmed,
        section: parsedQuery?.sectionIntent ?? null,
        brandModelId: parsedQuery?.model?.id ?? null,
        brandId: brandUnknown ? null : (brandRow?.id ?? null),
        lengthToken: parsedQuery?.lengthToken ?? null,
      })
    : null

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
          {filtersHref ? (
            <SearchResultsFilterButton href={filtersHref} />
          ) : (
            <Suspense fallback={null}>
              <SearchCategoryFilters
                query={rawQuery}
                selectedSlug={selectedSlug}
                categories={sortedCategories}
                brandSlug={brandRow?.slug ?? (brandSlugRequested || null)}
              />
            </Suspense>
          )}
        </div>
      </section>

      <section className="container mx-auto py-8">
        {listings.length === 0 && rawQuery.trim() && !brandUnknown ? (
          <BoardsNoResultsSaveSearch
            criteria={savedSearchCriteria ?? marketplaceSearchSavedCriteria(rawQuery)}
            isLoggedIn={!!user}
            initialSavedSearchId={savedSearchId}
            clearHref="/search/recent"
          />
        ) : (
          <>
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
            {listings.length > 0 && rawQuery.trim() && !brandUnknown ? (
              <BoardsNoResultsSaveSearch
                variant="compact"
                criteria={savedSearchCriteria ?? marketplaceSearchSavedCriteria(rawQuery)}
                isLoggedIn={!!user}
                initialSavedSearchId={savedSearchId}
              />
            ) : null}
          </>
        )}
      </section>
    </main>
  )
}
