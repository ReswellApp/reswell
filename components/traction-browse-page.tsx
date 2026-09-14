import { Suspense } from "react"
import { BoardsBrowsePagination } from "@/components/boards-browse-pagination"
import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import { CategoryBrowseBreadcrumbs } from "@/components/category-browse-breadcrumbs"
import { createClient } from "@/lib/supabase/server"
import { TractionBrowseClient } from "@/components/traction-browse-client"
import { BoardsNoResultsSaveSearch } from "@/components/boards-no-results-save-search"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { peerSavedSearchCriteriaFromBrowseParams } from "@/lib/utils/peer-saved-search-criteria"
import { fetchTractionBrowsePage, TRACTION_BROWSE_PAGE_SIZE } from "@/lib/db/traction-listings"
import { tractionFacetSelectionsFromParams } from "@/lib/traction-browse-facets"
import {
  tractionBrowseFilterHeadline,
  tractionBrowseHeroSubtext,
  tractionBrowseRootLabel,
  type TractionBrowseSearchParams,
} from "@/lib/traction-browse-metadata"

async function TractionListings({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<TractionBrowseSearchParams>
}) {
  const searchParams = await searchParamsPromise
  const supabase = await createClient()
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1)

  const facets = tractionFacetSelectionsFromParams(searchParams)
  const minPrice = searchParams.minPrice ? Number(searchParams.minPrice) : undefined
  const maxPrice = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined

  const { traction, totalPages } = await fetchTractionBrowsePage(supabase, {
    facets,
    query: searchParams.q,
    brand: searchParams.brand,
    minPrice,
    maxPrice,
    sort: searchParams.sort,
    page,
    limit: TRACTION_BROWSE_PAGE_SIZE,
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (traction.length === 0) {
    return (
      <BoardsNoResultsSaveSearch
        criteria={peerSavedSearchCriteriaFromBrowseParams({
          section: "traction",
          q: searchParams.q,
          brand: searchParams.brand,
          condition: searchParams.condition,
          size: searchParams.size,
          minPrice: searchParams.minPrice,
          maxPrice: searchParams.maxPrice,
          sort: searchParams.sort,
        })}
        isLoggedIn={Boolean(user)}
        clearHref="/traction"
      />
    )
  }

  let favoritedIds: string[] = []
  if (user && traction.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in(
        "listing_id",
        traction.map((f) => f.id),
      )
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {traction.map((item) => (
          <HomePeerListingScrollTile
            key={item.id}
            layout="grid"
            userId={user?.id ?? null}
            isFavorited={favoritedIds.includes(item.id)}
            listing={{
              id: item.id,
              slug: item.slug,
              user_id: item.user_id,
              title: item.title,
              price: item.price,
              compare_at_price: item.compare_at_price,
              status: item.status,
              section: "traction",
              local_pickup: item.local_pickup,
              shipping_available: item.shipping_available,
              listing_images: item.listing_images,
              condition: item.condition,
            }}
          />
        ))}
      </div>
      <BoardsBrowsePagination page={page} totalPages={totalPages} />
    </>
  )
}

export async function TractionBrowsePage(props: {
  searchParams: Promise<TractionBrowseSearchParams>
}) {
  const searchParams = await props.searchParams
  const filterCrumb = tractionBrowseFilterHeadline(searchParams)

  return (
    <main className="flex-1">
      <section className="bg-offwhite pt-1 sm:pt-2 lg:pt-6">
        <div className="container mx-auto">
          <div className="border-t border-neutral-200 pt-2 lg:pt-3">
            <CategoryBrowseBreadcrumbs
              rootHref="/traction"
              rootLabel={tractionBrowseRootLabel}
              searchParams={searchParams}
              segment={
                filterCrumb && searchParams.size?.trim()
                  ? {
                      label: filterCrumb,
                      href: `/traction?size=${encodeURIComponent(searchParams.size.trim())}`,
                      ownedParamKeys: ["size"],
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </section>

      <section className="min-w-0 bg-offwhite pt-4 pb-4 sm:pt-5">
        <div className="container mx-auto min-w-0">
          <TractionBrowseClient
            title={filterCrumb ?? tractionBrowseRootLabel}
            description={tractionBrowseHeroSubtext(searchParams)}
          >
            <Suspense fallback={<ListingTileGridSkeleton count={10} ariaLabel="Loading traction" />}>
              <TractionListings searchParams={props.searchParams} />
            </Suspense>
          </TractionBrowseClient>
        </div>
      </section>
    </main>
  )
}
