import { Suspense } from "react"
import Link from "next/link"
import { BoardsBrowsePagination } from "@/components/boards-browse-pagination"
import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { createClient } from "@/lib/supabase/server"
import { ApparelBrowseClient } from "@/components/apparel-browse-client"
import { BoardsNoResultsSaveSearch } from "@/components/boards-no-results-save-search"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { peerSavedSearchCriteriaFromBrowseParams } from "@/lib/utils/peer-saved-search-criteria"
import { fetchApparelBrowsePage, APPAREL_BROWSE_PAGE_SIZE } from "@/lib/db/apparel-listings"
import { apparelFacetSelectionsFromParams } from "@/lib/apparel-browse-facets"
import {
  apparelBrowseFilterHeadline,
  apparelBrowseHeroSubtext,
  apparelBrowseRootLabel,
  type ApparelBrowseSearchParams,
} from "@/lib/apparel-browse-metadata"

async function ApparelListings({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<ApparelBrowseSearchParams>
}) {
  const searchParams = await searchParamsPromise
  const supabase = await createClient()
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1)

  const facets = apparelFacetSelectionsFromParams(searchParams)
  const minPrice = searchParams.minPrice ? Number(searchParams.minPrice) : undefined
  const maxPrice = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined

  const { apparel, totalPages } = await fetchApparelBrowsePage(supabase, {
    facets,
    query: searchParams.q,
    brand: searchParams.brand,
    minPrice,
    maxPrice,
    sort: searchParams.sort,
    page,
    limit: APPAREL_BROWSE_PAGE_SIZE,
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (apparel.length === 0) {
    return (
      <BoardsNoResultsSaveSearch
        criteria={peerSavedSearchCriteriaFromBrowseParams({
          section: "apparel",
          q: searchParams.q,
          brand: searchParams.brand,
          condition: searchParams.condition,
          kind: searchParams.kind,
          size: searchParams.size,
          minPrice: searchParams.minPrice,
          maxPrice: searchParams.maxPrice,
          sort: searchParams.sort,
        })}
        isLoggedIn={Boolean(user)}
        clearHref="/apparel"
      />
    )
  }

  let favoritedIds: string[] = []
  if (user && apparel.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in(
        "listing_id",
        apparel.map((f) => f.id),
      )
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {apparel.map((apparel) => (
          <HomePeerListingScrollTile
            key={apparel.id}
            layout="grid"
            userId={user?.id ?? null}
            isFavorited={favoritedIds.includes(apparel.id)}
            listing={{
              id: apparel.id,
              slug: apparel.slug,
              user_id: apparel.user_id,
              title: apparel.title,
              price: apparel.price,
              status: apparel.status,
              section: "apparel",
              local_pickup: apparel.local_pickup,
              shipping_available: apparel.shipping_available,
              listing_images: apparel.listing_images,
              condition: apparel.condition,
            }}
          />
        ))}
      </div>
      <BoardsBrowsePagination page={page} totalPages={totalPages} />
    </>
  )
}

export async function ApparelBrowsePage(props: {
  searchParams: Promise<ApparelBrowseSearchParams>
}) {
  const searchParams = await props.searchParams
  const filterCrumb = apparelBrowseFilterHeadline(searchParams)

  return (
    <main className="flex-1">
      <section className="bg-offwhite pt-1 pb-4 sm:pt-2 sm:pb-5 lg:pt-8 lg:pb-5">
        <div className="container mx-auto">
          <div className="mb-4 border-t border-neutral-200 pt-2 lg:pt-4">
            <Breadcrumb>
              <BreadcrumbList className="gap-1.5 text-sm font-normal text-[#5c6b89] sm:gap-2">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                    <Link href="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                {filterCrumb ? (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                        <Link href="/apparel">{apparelBrowseRootLabel}</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="font-normal text-[#5c6b89]">{filterCrumb}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                ) : (
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-normal text-[#5c6b89]">
                      {apparelBrowseRootLabel}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-center text-3xl font-bold">
              {filterCrumb ?? apparelBrowseRootLabel}
            </h1>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground sm:text-base">
            {apparelBrowseHeroSubtext(searchParams)}
          </p>
        </div>
      </section>

      <section className="min-w-0 pt-2 pb-4">
        <div className="container mx-auto min-w-0">
          <ApparelBrowseClient>
            <Suspense fallback={<ListingTileGridSkeleton count={10} ariaLabel="Loading apparel" />}>
              <ApparelListings searchParams={props.searchParams} />
            </Suspense>
          </ApparelBrowseClient>
        </div>
      </section>
    </main>
  )
}
