import { Suspense } from "react"
import { BoardsBrowsePagination } from "@/components/boards-browse-pagination"
import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import { CategoryBrowseBreadcrumbs } from "@/components/category-browse-breadcrumbs"
import { createClient } from "@/lib/supabase/server"
import { LeashesBrowseClient } from "@/components/leashes-browse-client"
import { BoardsNoResultsSaveSearch } from "@/components/boards-no-results-save-search"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { peerSavedSearchCriteriaFromBrowseParams } from "@/lib/utils/peer-saved-search-criteria"
import { fetchLeashesBrowsePage, LEASHES_BROWSE_PAGE_SIZE } from "@/lib/db/leash-listings"
import { leashFacetSelectionsFromParams } from "@/lib/leashes-browse-facets"
import {
  leashesBrowseFilterHeadline,
  leashesBrowseHeroSubtext,
  leashesBrowseRootLabel,
  type LeashesBrowseSearchParams,
} from "@/lib/leashes-browse-metadata"

async function LeashListings({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<LeashesBrowseSearchParams>
}) {
  const searchParams = await searchParamsPromise
  const supabase = await createClient()
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1)

  const facets = leashFacetSelectionsFromParams(searchParams)
  const minPrice = searchParams.minPrice ? Number(searchParams.minPrice) : undefined
  const maxPrice = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined

  const { leashes, totalPages } = await fetchLeashesBrowsePage(supabase, {
    facets,
    query: searchParams.q,
    brand: searchParams.brand,
    minPrice,
    maxPrice,
    sort: searchParams.sort,
    page,
    limit: LEASHES_BROWSE_PAGE_SIZE,
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (leashes.length === 0) {
    return (
      <BoardsNoResultsSaveSearch
        criteria={peerSavedSearchCriteriaFromBrowseParams({
          section: "leashes",
          q: searchParams.q,
          brand: searchParams.brand,
          condition: searchParams.condition,
          size: searchParams.size,
          minPrice: searchParams.minPrice,
          maxPrice: searchParams.maxPrice,
          sort: searchParams.sort,
        })}
        isLoggedIn={Boolean(user)}
        clearHref="/leashes"
      />
    )
  }

  let favoritedIds: string[] = []
  if (user && leashes.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in(
        "listing_id",
        leashes.map((f) => f.id),
      )
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {leashes.map((leash) => (
          <HomePeerListingScrollTile
            key={leash.id}
            layout="grid"
            userId={user?.id ?? null}
            isFavorited={favoritedIds.includes(leash.id)}
            listing={{
              id: leash.id,
              slug: leash.slug,
              user_id: leash.user_id,
              title: leash.title,
              price: leash.price,
              status: leash.status,
              section: "leashes",
              local_pickup: leash.local_pickup,
              shipping_available: leash.shipping_available,
              listing_images: leash.listing_images,
              condition: leash.condition,
            }}
          />
        ))}
      </div>
      <BoardsBrowsePagination page={page} totalPages={totalPages} />
    </>
  )
}

export async function LeashesBrowsePage(props: {
  searchParams: Promise<LeashesBrowseSearchParams>
}) {
  const searchParams = await props.searchParams
  const filterCrumb = leashesBrowseFilterHeadline(searchParams)

  return (
    <main className="flex-1">
      <section className="bg-offwhite pt-1 sm:pt-2 lg:pt-6">
        <div className="container mx-auto">
          <div className="border-t border-neutral-200 pt-2 lg:pt-3">
            <CategoryBrowseBreadcrumbs
              rootHref="/leashes"
              rootLabel={leashesBrowseRootLabel}
              searchParams={searchParams}
              segment={
                filterCrumb && searchParams.size?.trim()
                  ? {
                      label: filterCrumb,
                      href: `/leashes?size=${encodeURIComponent(searchParams.size.trim())}`,
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
          <LeashesBrowseClient
            title={filterCrumb ?? leashesBrowseRootLabel}
            description={leashesBrowseHeroSubtext(searchParams)}
          >
            <Suspense fallback={<ListingTileGridSkeleton count={10} ariaLabel="Loading leashes" />}>
              <LeashListings searchParams={props.searchParams} />
            </Suspense>
          </LeashesBrowseClient>
        </div>
      </section>
    </main>
  )
}
