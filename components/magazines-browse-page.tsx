import { Suspense } from "react"
import Link from "next/link"
import { BookOpen } from "lucide-react"
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
import { MagazinesBrowseClient } from "@/components/magazines-browse-client"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
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

  if (magazines.length === 0) {
    return (
      <div className="py-16 text-center">
        <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="mb-2 text-lg font-medium">No magazines found</p>
        <p className="mb-4 text-muted-foreground">Try adjusting your search or filters</p>
        <Button variant="outline" asChild>
          <Link href="/magazines">Clear filters</Link>
        </Button>
      </div>
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
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
                        <Link href="/magazines">{magazinesBrowseRootLabel}</Link>
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
                      {magazinesBrowseRootLabel}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-center text-3xl font-bold">
              {filterCrumb ?? magazinesBrowseRootLabel}
            </h1>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground sm:text-base">
            {magazinesBrowseHeroSubtext(searchParams)}
          </p>
        </div>
      </section>

      <section className="min-w-0 pt-2 pb-4">
        <div className="container mx-auto min-w-0">
          <MagazinesBrowseClient>
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
