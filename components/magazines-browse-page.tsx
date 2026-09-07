import { Suspense } from "react"
import { BoardsBrowsePagination } from "@/components/boards-browse-pagination"
import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import { CategoryBrowseBreadcrumbs } from "@/components/category-browse-breadcrumbs"
import { createClient } from "@/lib/supabase/server"
import { MagazinesBrowseClient } from "@/components/magazines-browse-client"
import { BoardsNoResultsSaveSearch } from "@/components/boards-no-results-save-search"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { peerSavedSearchCriteriaFromBrowseParams } from "@/lib/utils/peer-saved-search-criteria"
import {
  fetchMagazinesBrowsePage,
  MAGAZINES_BROWSE_PAGE_SIZE,
} from "@/lib/db/magazine-listings"
import { magazineFacetSelectionsFromParams } from "@/lib/magazines-browse-facets"
import {
  magazinesBrowseFilterHeadline,
  magazinesBrowseHeroSubtext,
  magazinesBrowseRootLabel,
  magazinesBrowseSearchParamsKey,
  type MagazinesBrowseSearchParams,
} from "@/lib/magazines-browse-metadata"

async function MagazineListings({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<MagazinesBrowseSearchParams>
}) {
  const searchParams = await searchParamsPromise
  const supabase = await createClient()
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1)

  const facets = magazineFacetSelectionsFromParams(searchParams)
  const minPrice = searchParams.minPrice ? Number(searchParams.minPrice) : undefined
  const maxPrice = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined
  const minYear = searchParams.minYear ? Number(searchParams.minYear) : undefined
  const maxYear = searchParams.maxYear ? Number(searchParams.maxYear) : undefined

  const { magazines, totalPages } = await fetchMagazinesBrowsePage(supabase, {
    facets,
    query: searchParams.q,
    brand: searchParams.brand,
    minPrice: minPrice != null && Number.isFinite(minPrice) ? minPrice : undefined,
    maxPrice: maxPrice != null && Number.isFinite(maxPrice) ? maxPrice : undefined,
    minYear: minYear != null && Number.isFinite(minYear) ? minYear : undefined,
    maxYear: maxYear != null && Number.isFinite(maxYear) ? maxYear : undefined,
    sort: searchParams.sort,
    page,
    limit: MAGAZINES_BROWSE_PAGE_SIZE,
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (magazines.length === 0) {
    return (
      <BoardsNoResultsSaveSearch
        criteria={peerSavedSearchCriteriaFromBrowseParams({
          section: "magazines",
          q: searchParams.q,
          brand: searchParams.brand,
          condition: searchParams.condition,
          minPrice: searchParams.minPrice,
          maxPrice: searchParams.maxPrice,
          minYear: searchParams.minYear,
          maxYear: searchParams.maxYear,
          sort: searchParams.sort,
        })}
        isLoggedIn={Boolean(user)}
        clearHref="/magazines"
      />
    )
  }

  let favoritedIds: string[] = []
  if (user && magazines.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in(
        "listing_id",
        magazines.map((m) => m.id),
      )
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {magazines.map((magazine) => (
          <HomePeerListingScrollTile
            key={magazine.id}
            layout="grid"
            userId={user?.id ?? null}
            isFavorited={favoritedIds.includes(magazine.id)}
            listing={{
              id: magazine.id,
              slug: magazine.slug,
              user_id: magazine.user_id,
              title: magazine.title,
              price: magazine.price,
              compare_at_price: magazine.compare_at_price,
              status: magazine.status,
              section: "magazines",
              shipping_available: magazine.shipping_available,
              local_pickup: false,
              listing_images: magazine.listing_images,
              condition: magazine.condition,
            }}
          />
        ))}
      </div>
      <BoardsBrowsePagination page={page} totalPages={totalPages} />
    </>
  )
}

export async function MagazinesBrowsePage(props: {
  searchParams: Promise<MagazinesBrowseSearchParams>
}) {
  const searchParams = await props.searchParams
  const searchParamsPromise = Promise.resolve(searchParams)
  const listingsSuspenseKey = magazinesBrowseSearchParamsKey(searchParams)
  const filterCrumb = magazinesBrowseFilterHeadline(searchParams)

  return (
    <main className="flex-1">
      <section className="bg-offwhite pt-1 sm:pt-2 lg:pt-6">
        <div className="container mx-auto">
          <div className="border-t border-neutral-200 pt-2 lg:pt-3">
            <CategoryBrowseBreadcrumbs
              rootHref="/magazines"
              rootLabel={magazinesBrowseRootLabel}
              searchParams={searchParams}
              segment={
                filterCrumb && searchParams.condition?.trim()
                  ? {
                      label: filterCrumb,
                      href: `/magazines?condition=${encodeURIComponent(searchParams.condition.trim())}`,
                      ownedParamKeys: ["condition"],
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </section>

      <section className="min-w-0 bg-offwhite pt-4 pb-4 sm:pt-5">
        <div className="container mx-auto min-w-0">
          <MagazinesBrowseClient
            title={filterCrumb ?? magazinesBrowseRootLabel}
            description={magazinesBrowseHeroSubtext(searchParams)}
          >
            <Suspense
              key={listingsSuspenseKey}
              fallback={<ListingTileGridSkeleton count={10} ariaLabel="Loading magazines" />}
            >
              <MagazineListings searchParams={searchParamsPromise} />
            </Suspense>
          </MagazinesBrowseClient>
        </div>
      </section>
    </main>
  )
}
