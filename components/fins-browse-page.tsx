import { Suspense } from "react"
import Link from "next/link"
import { Users } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { FinsBrowseClient } from "@/components/fins-browse-client"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { fetchFinsBrowsePage, FINS_BROWSE_PAGE_SIZE } from "@/lib/db/fin-listings"
import { finFacetSelectionsFromParams } from "@/lib/fins-browse-facets"
import {
  finsBrowseFilterHeadline,
  finsBrowseHeroSubtext,
  finsBrowseRootLabel,
  type FinsBrowseSearchParams,
} from "@/lib/fins-browse-metadata"

async function FinListings({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<FinsBrowseSearchParams>
}) {
  const searchParams = await searchParamsPromise
  const supabase = await createClient()
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1)

  const facets = finFacetSelectionsFromParams(searchParams)
  const minPrice = searchParams.minPrice ? Number(searchParams.minPrice) : undefined
  const maxPrice = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined

  const { fins, totalPages } = await fetchFinsBrowsePage(supabase, {
    facets,
    query: searchParams.q,
    brand: searchParams.brand,
    minPrice,
    maxPrice,
    sort: searchParams.sort,
    page,
    limit: FINS_BROWSE_PAGE_SIZE,
  })

  if (fins.length === 0) {
    return (
      <div className="py-16 text-center">
        <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="mb-2 text-lg font-medium">No fins found</p>
        <p className="mb-4 text-muted-foreground">Try adjusting your search or filters</p>
        <Button variant="outline" asChild>
          <Link href="/fins">Clear Filters</Link>
        </Button>
      </div>
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  let favoritedIds: string[] = []
  if (user && fins.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in(
        "listing_id",
        fins.map((f) => f.id),
      )
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {fins.map((fin) => (
          <HomePeerListingScrollTile
            key={fin.id}
            layout="grid"
            userId={user?.id ?? null}
            isFavorited={favoritedIds.includes(fin.id)}
            listing={{
              id: fin.id,
              slug: fin.slug,
              user_id: fin.user_id,
              title: fin.title,
              price: fin.price,
              status: fin.status,
              section: "fins",
              local_pickup: fin.local_pickup,
              shipping_available: fin.shipping_available,
              listing_images: fin.listing_images,
              condition: fin.condition,
            }}
          />
        ))}
      </div>
      <BoardsBrowsePagination page={page} totalPages={totalPages} />
    </>
  )
}

export async function FinsBrowsePage(props: {
  searchParams: Promise<FinsBrowseSearchParams>
}) {
  const searchParams = await props.searchParams
  const filterCrumb = finsBrowseFilterHeadline(searchParams)

  return (
    <main className="flex-1">
      <section className="bg-offwhite pt-6 pb-4 sm:pt-8 sm:pb-5">
        <div className="container mx-auto">
          <div className="mb-4 border-t border-neutral-200 pt-4">
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
                        <Link href="/fins">{finsBrowseRootLabel}</Link>
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
                      {finsBrowseRootLabel}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-center text-3xl font-bold">
              {filterCrumb ?? finsBrowseRootLabel}
            </h1>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground sm:text-base">
            {finsBrowseHeroSubtext(searchParams)}
          </p>
        </div>
      </section>

      <section className="min-w-0 pt-2 pb-4">
        <div className="container mx-auto min-w-0">
          <FinsBrowseClient>
            <Suspense fallback={<ListingTileGridSkeleton count={10} ariaLabel="Loading fins" />}>
              <FinListings searchParams={props.searchParams} />
            </Suspense>
          </FinsBrowseClient>
        </div>
      </section>
    </main>
  )
}
