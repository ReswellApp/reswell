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
import { WetsuitsBrowseClient } from "@/components/wetsuits-browse-client"
import { BoardsNoResultsSaveSearch } from "@/components/boards-no-results-save-search"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { fetchWetsuitsBrowsePage, WETSUITS_BROWSE_PAGE_SIZE } from "@/lib/db/wetsuit-listings"
import { wetsuitFacetSelectionsFromParams } from "@/lib/wetsuits-browse-facets"
import {
  wetsuitsBrowseFilterHeadline,
  wetsuitsBrowseHeroSubtext,
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
                        <Link href="/wetsuits">{wetsuitsBrowseRootLabel}</Link>
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
                      {wetsuitsBrowseRootLabel}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-center text-3xl font-bold">
              {filterCrumb ?? wetsuitsBrowseRootLabel}
            </h1>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground sm:text-base">
            {wetsuitsBrowseHeroSubtext(searchParams)}
          </p>
        </div>
      </section>

      <section className="min-w-0 pt-2 pb-4">
        <div className="container mx-auto min-w-0">
          <WetsuitsBrowseClient>
            <Suspense fallback={<ListingTileGridSkeleton count={10} ariaLabel="Loading wetsuits" />}>
              <WetsuitListings searchParams={props.searchParams} />
            </Suspense>
          </WetsuitsBrowseClient>
        </div>
      </section>
    </main>
  )
}
