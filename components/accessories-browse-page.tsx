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
import { AccessoriesBrowseClient } from "@/components/accessories-browse-client"
import { BoardsNoResultsSaveSearch } from "@/components/boards-no-results-save-search"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { peerSavedSearchCriteriaFromBrowseParams } from "@/lib/utils/peer-saved-search-criteria"
import { fetchAccessoriesBrowsePage, ACCESSORIES_BROWSE_PAGE_SIZE } from "@/lib/db/accessory-listings"
import { accessoryFacetSelectionsFromParams } from "@/lib/accessories-browse-facets"
import {
  accessoriesBrowseFilterHeadline,
  accessoriesBrowseHeroSubtext,
  accessoriesBrowseRootLabel,
  type AccessoriesBrowseSearchParams,
} from "@/lib/accessories-browse-metadata"

async function AccessoryListings({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<AccessoriesBrowseSearchParams>
}) {
  const searchParams = await searchParamsPromise
  const supabase = await createClient()
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1)

  const facets = accessoryFacetSelectionsFromParams(searchParams)
  const minPrice = searchParams.minPrice ? Number(searchParams.minPrice) : undefined
  const maxPrice = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined

  const { accessories, totalPages } = await fetchAccessoriesBrowsePage(supabase, {
    facets,
    query: searchParams.q,
    brand: searchParams.brand,
    minPrice,
    maxPrice,
    sort: searchParams.sort,
    page,
    limit: ACCESSORIES_BROWSE_PAGE_SIZE,
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (accessories.length === 0) {
    return (
      <BoardsNoResultsSaveSearch
        criteria={peerSavedSearchCriteriaFromBrowseParams({
          section: "accessories",
          q: searchParams.q,
          brand: searchParams.brand,
          condition: searchParams.condition,
          size: searchParams.size,
          minPrice: searchParams.minPrice,
          maxPrice: searchParams.maxPrice,
          sort: searchParams.sort,
        })}
        isLoggedIn={Boolean(user)}
        clearHref="/accessories"
      />
    )
  }

  let favoritedIds: string[] = []
  if (user && accessories.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in(
        "listing_id",
        accessories.map((f) => f.id),
      )
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {accessories.map((accessory) => (
          <HomePeerListingScrollTile
            key={accessory.id}
            layout="grid"
            userId={user?.id ?? null}
            isFavorited={favoritedIds.includes(accessory.id)}
            listing={{
              id: accessory.id,
              slug: accessory.slug,
              user_id: accessory.user_id,
              title: accessory.title,
              price: accessory.price,
              status: accessory.status,
              section: "accessories",
              local_pickup: accessory.local_pickup,
              shipping_available: accessory.shipping_available,
              listing_images: accessory.listing_images,
              condition: accessory.condition,
            }}
          />
        ))}
      </div>
      <BoardsBrowsePagination page={page} totalPages={totalPages} />
    </>
  )
}

export async function AccessoriesBrowsePage(props: {
  searchParams: Promise<AccessoriesBrowseSearchParams>
}) {
  const searchParams = await props.searchParams
  const filterCrumb = accessoriesBrowseFilterHeadline(searchParams)

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
                        <Link href="/accessories">{accessoriesBrowseRootLabel}</Link>
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
                      {accessoriesBrowseRootLabel}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-center text-3xl font-bold">
              {filterCrumb ?? accessoriesBrowseRootLabel}
            </h1>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground sm:text-base">
            {accessoriesBrowseHeroSubtext(searchParams)}
          </p>
        </div>
      </section>

      <section className="min-w-0 pt-2 pb-4">
        <div className="container mx-auto min-w-0">
          <AccessoriesBrowseClient>
            <Suspense fallback={<ListingTileGridSkeleton count={10} ariaLabel="Loading accessories" />}>
              <AccessoryListings searchParams={props.searchParams} />
            </Suspense>
          </AccessoriesBrowseClient>
        </div>
      </section>
    </main>
  )
}
