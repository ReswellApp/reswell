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
import { SurfpacksBrowseClient } from "@/components/surfpacks-browse-client"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
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

  if (surfpacks.length === 0) {
    return (
      <div className="py-16 text-center">
        <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="mb-2 text-lg font-medium">No surfpacks found</p>
        <p className="mb-4 text-muted-foreground">Try adjusting your search or filters</p>
        <Button variant="outline" asChild>
          <Link href="/surfpacks">Clear Filters</Link>
        </Button>
      </div>
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
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
                        <Link href="/surfpacks">{surfpacksBrowseRootLabel}</Link>
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
                      {surfpacksBrowseRootLabel}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-center text-3xl font-bold">
              {filterCrumb ?? surfpacksBrowseRootLabel}
            </h1>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground sm:text-base">
            {surfpacksBrowseHeroSubtext(searchParams)}
          </p>
        </div>
      </section>

      <section className="min-w-0 pt-2 pb-4">
        <div className="container mx-auto min-w-0">
          <SurfpacksBrowseClient>
            <Suspense fallback={<ListingTileGridSkeleton count={10} ariaLabel="Loading surfpacks" />}>
              <SurfpackListings searchParams={props.searchParams} />
            </Suspense>
          </SurfpacksBrowseClient>
        </div>
      </section>
    </main>
  )
}
