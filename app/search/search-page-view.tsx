import { Suspense, type ReactNode } from "react"
import { after } from "next/server"
import { redirect } from "next/navigation"
import { SearchCategoryFilters } from "./search-section-filters"
import type { RecentListing } from "@/components/recent-feed-client"
import { RecentFeedClient } from "@/components/recent-feed-client"
import { BoardsNoResultsSaveSearch } from "@/components/boards-no-results-save-search"
import { marketplaceSearchSavedCriteria } from "@/lib/utils/peer-saved-search-criteria"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { getMarketplaceSearchPageCached } from "@/lib/cache/marketplace-search"
import { listFavoritedListingIdsAmong } from "@/lib/db/favorites"
import {
  displayMarketplaceSearchQueryForAnalytics,
  normalizeMarketplaceSearchQueryForAnalytics,
  recordMarketplaceSearchAnalyticsEvent,
} from "@/lib/services/searchAnalytics"
import {
  newSearchQualityEventId,
  scheduleSearchQualityEventCapture,
} from "@/lib/services/searchQuality"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

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
  const payload = await getMarketplaceSearchPageCached(
    rawQuery,
    brandSlugFromUrl,
    categorySlugFromUrl,
  )

  if (!categorySlugFromUrl.trim() && payload.modelPageHref) {
    redirect(payload.modelPageHref)
  }

  const {
    listings,
    searchMeta,
    brandRow,
    brandUnknown,
    brandTypoCorrected,
    parsedQuery,
    selectedSlug,
    categorySlugForLog,
    sortedCategories,
  } = payload
  const brandSlugRequested = brandSlugFromUrl.trim()
  const queryTrimmed = rawQuery.trim()

  if (queryTrimmed) {
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
      listings: listings.map((listing) => ({
        id: listing.id,
        title: listing.title,
        slug: listing.slug,
        price: listing.price,
        board_type: listing.board_type,
        listing_images: listing.listing_images,
      })),
      parsed: parsedQuery,
    })
  }

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

  const emptyMessage = brandUnknown
    ? "No brand matches that URL. Return to search and pick a brand from suggestions."
    : brandRow
      ? "No active listings for this brand yet. Try another category or check back soon."
      : "No listings to show yet. Check back soon or browse by category."

  const saveCriteria = marketplaceSearchSavedCriteria(rawQuery)

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
        {listings.length === 0 && queryTrimmed && !brandUnknown ? (
          <Suspense
            fallback={
              <BoardsNoResultsSaveSearch
                criteria={saveCriteria}
                isLoggedIn={false}
                clearHref="/search/recent"
              />
            }
          >
            <SearchEmptySaveSearch criteria={saveCriteria} skipAuthLookup={skipAuthLookup} />
          </Suspense>
        ) : (
          <Suspense
            fallback={
              <RecentFeedClient
                listings={listings}
                favoritedListingIds={[]}
                isLoggedIn={false}
                viewerUserId={null}
                emptyMessage={emptyMessage}
              />
            }
          >
            <SearchResultsWithFavorites
              listings={listings}
              emptyMessage={emptyMessage}
              skipAuthLookup={skipAuthLookup}
            />
          </Suspense>
        )}
      </section>
    </main>
  )
}

async function SearchEmptySaveSearch({
  criteria,
  skipAuthLookup,
}: {
  criteria: BoardSavedSearchCriteria
  skipAuthLookup: boolean
}) {
  if (skipAuthLookup) {
    return (
      <BoardsNoResultsSaveSearch
        criteria={criteria}
        isLoggedIn={false}
        clearHref="/search/recent"
      />
    )
  }

  const { user } = await getCachedRequestSession()
  return (
    <BoardsNoResultsSaveSearch
      criteria={criteria}
      isLoggedIn={Boolean(user)}
      clearHref="/search/recent"
    />
  )
}

async function SearchResultsWithFavorites({
  listings,
  emptyMessage,
  skipAuthLookup,
}: {
  listings: RecentListing[]
  emptyMessage: string
  skipAuthLookup: boolean
}) {
  if (skipAuthLookup) {
    return (
      <RecentFeedClient
        listings={listings}
        favoritedListingIds={[]}
        isLoggedIn={false}
        viewerUserId={null}
        hydrateOwnFavorites
        emptyMessage={emptyMessage}
      />
    )
  }

  const { supabase, user } = await getCachedRequestSession()
  const favoritedListingIds =
    user && listings.length > 0
      ? await listFavoritedListingIdsAmong(
          supabase,
          user.id,
          listings.map((listing) => listing.id),
        )
      : []

  return (
    <RecentFeedClient
      listings={listings}
      favoritedListingIds={favoritedListingIds}
      isLoggedIn={Boolean(user)}
      viewerUserId={user?.id ?? null}
      emptyMessage={emptyMessage}
    />
  )
}
