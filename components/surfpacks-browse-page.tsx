import { Suspense } from "react"
import { BoardsBrowsePagination } from "@/components/boards-browse-pagination"
import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import { CategoryBrowseBreadcrumbs } from "@/components/category-browse-breadcrumbs"
import { createClient } from "@/lib/supabase/server"
import { SurfpacksBrowseClient } from "@/components/surfpacks-browse-client"
import { BoardsNoResultsSaveSearch } from "@/components/boards-no-results-save-search"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { peerSavedSearchCriteriaFromBrowseParams } from "@/lib/utils/peer-saved-search-criteria"
import { fetchSurfpacksBrowsePage, SURFPACKS_BROWSE_PAGE_SIZE } from "@/lib/db/surfpack-listings"
import { surfpackFacetSelectionsFromParams } from "@/lib/surfpacks-browse-facets"
import {
  surfpacksBrowseFilterHeadline,
  surfpacksBrowseHeroSubtext,
  surfpacksBrowseRootLabel,
  type SurfpacksBrowseSearchParams,
} from "@/lib/surfpacks-browse-metadata"

async function SurfpackListings({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<SurfpacksBrowseSearchParams>
}) {
  const searchParams = await searchParamsPromise
  const supabase = await createClient()
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1)

  const facets = surfpackFacetSelectionsFromParams(searchParams)
  const minPrice = searchParams.minPrice ? Number(searchParams.minPrice) : undefined
  const maxPrice = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined

  const { surfpacks, totalPages } = await fetchSurfpacksBrowsePage(supabase, {
    facets,
    query: searchParams.q,
    brand: searchParams.brand,
    minPrice,
    maxPrice,
    sort: searchParams.sort,
    page,
    limit: SURFPACKS_BROWSE_PAGE_SIZE,
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (surfpacks.length === 0) {
    return (
      <BoardsNoResultsSaveSearch
        criteria={peerSavedSearchCriteriaFromBrowseParams({
          section: "surfpacks",
          q: searchParams.q,
          brand: searchParams.brand,
          condition: searchParams.condition,
          size: searchParams.size,
          minPrice: searchParams.minPrice,
          maxPrice: searchParams.maxPrice,
          sort: searchParams.sort,
        })}
        isLoggedIn={Boolean(user)}
        clearHref="/surfpacks"
      />
    )
  }

  let favoritedIds: string[] = []
  if (user && surfpacks.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in(
        "listing_id",
        surfpacks.map((f) => f.id),
      )
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {surfpacks.map((surfpack) => (
          <HomePeerListingScrollTile
            key={surfpack.id}
            layout="grid"
            userId={user?.id ?? null}
            isFavorited={favoritedIds.includes(surfpack.id)}
            listing={{
              id: surfpack.id,
              slug: surfpack.slug,
              user_id: surfpack.user_id,
              title: surfpack.title,
              price: surfpack.price,
              compare_at_price: surfpack.compare_at_price,
              status: surfpack.status,
              section: "surfpacks",
              local_pickup: surfpack.local_pickup,
              shipping_available: surfpack.shipping_available,
              listing_images: surfpack.listing_images,
              condition: surfpack.condition,
            }}
          />
        ))}
      </div>
      <BoardsBrowsePagination page={page} totalPages={totalPages} />
    </>
  )
}

export async function SurfpacksBrowsePage(props: {
  searchParams: Promise<SurfpacksBrowseSearchParams>
}) {
  const searchParams = await props.searchParams
  const filterCrumb = surfpacksBrowseFilterHeadline(searchParams)

  return (
    <main className="flex-1">
      <section className="bg-offwhite pt-1 sm:pt-2 lg:pt-6">
        <div className="container mx-auto">
          <div className="border-t border-neutral-200 pt-2 lg:pt-3">
            <CategoryBrowseBreadcrumbs
              rootHref="/surfpacks"
              rootLabel={surfpacksBrowseRootLabel}
              searchParams={searchParams}
              segment={
                filterCrumb && searchParams.size?.trim()
                  ? {
                      label: filterCrumb,
                      href: `/surfpacks?size=${encodeURIComponent(searchParams.size.trim())}`,
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
          <SurfpacksBrowseClient
            title={filterCrumb ?? surfpacksBrowseRootLabel}
            description={surfpacksBrowseHeroSubtext(searchParams)}
          >
            <Suspense fallback={<ListingTileGridSkeleton count={10} ariaLabel="Loading surfpacks" />}>
              <SurfpackListings searchParams={props.searchParams} />
            </Suspense>
          </SurfpacksBrowseClient>
        </div>
      </section>
    </main>
  )
}
