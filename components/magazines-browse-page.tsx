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
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { fetchMagazinesBrowsePage } from "@/lib/db/magazine-listings"
import { magazinesBrowseHeroSubtext, magazinesBrowseRootLabel } from "@/lib/magazines-browse-metadata"

async function MagazineListings({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const searchParams = await searchParamsPromise
  const supabase = await createClient()
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1)

  const { magazines, totalPages } = await fetchMagazinesBrowsePage(supabase, { page })

  if (magazines.length === 0) {
    return (
      <div className="py-16 text-center">
        <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="mb-2 text-lg font-medium">No magazines listed yet</p>
        <p className="mb-4 text-muted-foreground">Check back soon for new issues.</p>
        <Button variant="outline" asChild>
          <Link href="/magazines">Refresh</Link>
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
  searchParams: Promise<{ page?: string }>
}) {
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
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-normal text-[#5c6b89]">
                    {magazinesBrowseRootLabel}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-center text-3xl font-bold">{magazinesBrowseRootLabel}</h1>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground sm:text-base">
            {magazinesBrowseHeroSubtext()}
          </p>
        </div>
      </section>

      <section className="min-w-0 pt-2 pb-4">
        <div className="container mx-auto min-w-0">
          <Suspense fallback={<ListingTileGridSkeleton count={10} ariaLabel="Loading magazines" />}>
            <MagazineListings searchParams={props.searchParams} />
          </Suspense>
        </div>
      </section>
    </main>
  )
}
