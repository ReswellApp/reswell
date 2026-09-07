import { Suspense } from "react"
import { BoardsBrowsePagination } from "@/components/boards-browse-pagination"
import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import { CategoryBrowseBreadcrumbs } from "@/components/category-browse-breadcrumbs"
import { createClient } from "@/lib/supabase/server"
import { BoardbagsBrowseClient } from "@/components/boardbags-browse-client"
import { BoardsNoResultsSaveSearch } from "@/components/boards-no-results-save-search"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { peerSavedSearchCriteriaFromBrowseParams } from "@/lib/utils/peer-saved-search-criteria"
import { fetchBoardbagsBrowsePage, BOARDBAGS_BROWSE_PAGE_SIZE } from "@/lib/db/boardbag-listings"
import { boardbagFacetSelectionsFromParams } from "@/lib/boardbags-browse-facets"
import {
  boardbagsBrowseFilterHeadline,
  boardbagsBrowseHeroSubtext,
  boardbagsBrowseRootLabel,
  type BoardbagsBrowseSearchParams,
} from "@/lib/boardbags-browse-metadata"

async function BoardbagListings({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<BoardbagsBrowseSearchParams>
}) {
  const searchParams = await searchParamsPromise
  const supabase = await createClient()
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1)

  const facets = boardbagFacetSelectionsFromParams(searchParams)
  const minPrice = searchParams.minPrice ? Number(searchParams.minPrice) : undefined
  const maxPrice = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined

  const { boardbags, totalPages } = await fetchBoardbagsBrowsePage(supabase, {
    facets,
    query: searchParams.q,
    brand: searchParams.brand,
    minPrice,
    maxPrice,
    sort: searchParams.sort,
    page,
    limit: BOARDBAGS_BROWSE_PAGE_SIZE,
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (boardbags.length === 0) {
    return (
      <BoardsNoResultsSaveSearch
        criteria={peerSavedSearchCriteriaFromBrowseParams({
          section: "boardbags",
          q: searchParams.q,
          brand: searchParams.brand,
          condition: searchParams.condition,
          size: searchParams.size,
          minPrice: searchParams.minPrice,
          maxPrice: searchParams.maxPrice,
          sort: searchParams.sort,
        })}
        isLoggedIn={Boolean(user)}
        clearHref="/boardbags"
      />
    )
  }

  let favoritedIds: string[] = []
  if (user && boardbags.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in(
        "listing_id",
        boardbags.map((f) => f.id),
      )
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {boardbags.map((boardbag) => (
          <HomePeerListingScrollTile
            key={boardbag.id}
            layout="grid"
            userId={user?.id ?? null}
            isFavorited={favoritedIds.includes(boardbag.id)}
            listing={{
              id: boardbag.id,
              slug: boardbag.slug,
              user_id: boardbag.user_id,
              title: boardbag.title,
              price: boardbag.price,
              compare_at_price: boardbag.compare_at_price,
              status: boardbag.status,
              section: "boardbags",
              local_pickup: boardbag.local_pickup,
              shipping_available: boardbag.shipping_available,
              listing_images: boardbag.listing_images,
              condition: boardbag.condition,
            }}
          />
        ))}
      </div>
      <BoardsBrowsePagination page={page} totalPages={totalPages} />
    </>
  )
}

export async function BoardbagsBrowsePage(props: {
  searchParams: Promise<BoardbagsBrowseSearchParams>
}) {
  const searchParams = await props.searchParams
  const filterCrumb = boardbagsBrowseFilterHeadline(searchParams)

  return (
    <main className="flex-1">
      <section className="bg-offwhite pt-1 sm:pt-2 lg:pt-6">
        <div className="container mx-auto">
          <div className="border-t border-neutral-200 pt-2 lg:pt-3">
            <CategoryBrowseBreadcrumbs
              rootHref="/boardbags"
              rootLabel={boardbagsBrowseRootLabel}
              searchParams={searchParams}
              segment={
                filterCrumb && searchParams.size?.trim()
                  ? {
                      label: filterCrumb,
                      href: `/boardbags?size=${encodeURIComponent(searchParams.size.trim())}`,
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
          <BoardbagsBrowseClient
            title={filterCrumb ?? boardbagsBrowseRootLabel}
            description={boardbagsBrowseHeroSubtext(searchParams)}
          >
            <Suspense fallback={<ListingTileGridSkeleton count={10} ariaLabel="Loading boardbags" />}>
              <BoardbagListings searchParams={props.searchParams} />
            </Suspense>
          </BoardbagsBrowseClient>
        </div>
      </section>
    </main>
  )
}
