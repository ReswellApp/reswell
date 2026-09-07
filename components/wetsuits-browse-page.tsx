import { Suspense } from "react"
import { BoardsBrowsePagination } from "@/components/boards-browse-pagination"
import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import { CategoryBrowseBreadcrumbs } from "@/components/category-browse-breadcrumbs"
import { createClient } from "@/lib/supabase/server"
import { WetsuitsBrowseClient } from "@/components/wetsuits-browse-client"
import { BoardsNoResultsSaveSearch } from "@/components/boards-no-results-save-search"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { fetchWetsuitsBrowsePage, WETSUITS_BROWSE_PAGE_SIZE } from "@/lib/db/wetsuit-listings"
import { wetsuitFacetSelectionsFromParams } from "@/lib/wetsuits-browse-facets"
import {
  wetsuitsBrowseFilterHeadline,
  wetsuitsBrowseRootLabel,
  type WetsuitsBrowseSearchParams,
} from "@/lib/wetsuits-browse-metadata"
import { peerSavedSearchCriteriaFromBrowseParams } from "@/lib/utils/peer-saved-search-criteria"

async function WetsuitListings({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<WetsuitsBrowseSearchParams>
}) {
  const searchParams = await searchParamsPromise
  const supabase = await createClient()
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1)

  const facets = wetsuitFacetSelectionsFromParams(searchParams)
  const minPrice = searchParams.minPrice ? Number(searchParams.minPrice) : undefined
  const maxPrice = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined

  const { wetsuits, totalPages } = await fetchWetsuitsBrowsePage(supabase, {
    facets,
    query: searchParams.q,
    brand: searchParams.brand,
    minPrice,
    maxPrice,
    sort: searchParams.sort,
    page,
    limit: WETSUITS_BROWSE_PAGE_SIZE,
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (wetsuits.length === 0) {
    return (
      <BoardsNoResultsSaveSearch
        criteria={peerSavedSearchCriteriaFromBrowseParams({
          section: "wetsuits",
          q: searchParams.q,
          brand: searchParams.brand,
          condition: searchParams.condition,
          size: searchParams.size,
          minPrice: searchParams.minPrice,
          maxPrice: searchParams.maxPrice,
          sort: searchParams.sort,
        })}
        isLoggedIn={Boolean(user)}
        clearHref="/wetsuits"
      />
    )
  }

  let favoritedIds: string[] = []
  if (user && wetsuits.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in(
        "listing_id",
        wetsuits.map((f) => f.id),
      )
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {wetsuits.map((wetsuit) => (
          <HomePeerListingScrollTile
            key={wetsuit.id}
            layout="grid"
            userId={user?.id ?? null}
            isFavorited={favoritedIds.includes(wetsuit.id)}
            listing={{
              id: wetsuit.id,
              slug: wetsuit.slug,
              user_id: wetsuit.user_id,
              title: wetsuit.title,
              price: wetsuit.price,
              compare_at_price: wetsuit.compare_at_price,
              status: wetsuit.status,
              section: "wetsuits",
              local_pickup: wetsuit.local_pickup,
              shipping_available: wetsuit.shipping_available,
              listing_images: wetsuit.listing_images,
              condition: wetsuit.condition,
            }}
          />
        ))}
      </div>
      <BoardsBrowsePagination page={page} totalPages={totalPages} />
    </>
  )
}

export async function WetsuitsBrowsePage(props: {
  searchParams: Promise<WetsuitsBrowseSearchParams>
}) {
  const searchParams = await props.searchParams
  const filterCrumb = wetsuitsBrowseFilterHeadline(searchParams)

  return (
    <main className="flex-1">
      <section className="bg-offwhite pt-1 sm:pt-2 lg:pt-6">
        <div className="container mx-auto">
          <div className="border-t border-neutral-200 pt-2 lg:pt-3">
            <CategoryBrowseBreadcrumbs
              rootHref="/wetsuits"
              rootLabel={wetsuitsBrowseRootLabel}
              searchParams={searchParams}
              segment={
                filterCrumb && searchParams.size?.trim()
                  ? {
                      label: filterCrumb,
                      href: `/wetsuits?size=${encodeURIComponent(searchParams.size.trim())}`,
                      ownedParamKeys: ["size"],
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </section>

      <section className="min-w-0 bg-offwhite pt-2 pb-4 sm:pt-5">
        <div className="container mx-auto min-w-0">
          <WetsuitsBrowseClient
            title={filterCrumb ?? wetsuitsBrowseRootLabel}
          >
            <Suspense fallback={<ListingTileGridSkeleton count={10} ariaLabel="Loading wetsuits" />}>
              <WetsuitListings searchParams={props.searchParams} />
            </Suspense>
          </WetsuitsBrowseClient>
        </div>
      </section>
    </main>
  )
}
