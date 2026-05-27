import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HomePeerListingScrollTile, type HomePeerScrollListing } from "@/components/features/home"
import { BrandMarketplaceListingsPreview } from "@/components/brands/brand-marketplace-listings-preview"
import { RecentFeedClient } from "@/components/recent-feed-client"
import type { UnavailableListingLandingModel } from "@/lib/services/unavailableListingLanding"
import type { BoardBrowseListingRow } from "@/lib/db/boards-browse-listings"
import { createClient } from "@/lib/supabase/server"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import { BRANDS_BASE } from "@/lib/brands/routes"

function boardRowToPeerListing(row: BoardBrowseListingRow): HomePeerScrollListing {
  return {
    id: row.id,
    slug: row.slug,
    user_id: row.user_id,
    title: row.title,
    price: row.price,
    status: row.status,
    section: "surfboards",
    local_pickup: row.local_pickup,
    shipping_available: row.shipping_available,
    listing_images: row.listing_images,
    categories: row.categories,
    board_type: row.board_type,
    condition: row.condition,
  }
}

export async function UnavailableListingLandingPage({
  landing,
}: {
  landing: UnavailableListingLandingModel
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const previewIds = [
    ...landing.brandLiveListings.map((l) => l.id),
    ...landing.brandSoldListings.map((l) => l.id),
    ...landing.fallbackLiveListings.map((l) => l.id),
    ...landing.browseBoards.map((b) => b.id),
  ]
  let favoritedIds: string[] = []
  if (user && previewIds.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in("listing_id", previewIds)
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  const hasBrandPreview =
    landing.brandLiveListings.length > 0 || landing.brandSoldListings.length > 0
  const hasFallback = landing.fallbackLiveListings.length > 0
  const hasRelated = hasBrandPreview || hasFallback

  return (
    <main className="flex-1 bg-background">
      <section className="border-b border-border/60 bg-offwhite py-12 sm:py-16">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            This board is no longer available
          </h1>
          <p className="mt-3 text-pretty text-base text-muted-foreground sm:text-lg">
            Check out related boards
          </p>
          {landing.listingTitle ? (
            <p className="mt-2 text-sm text-muted-foreground/90">{landing.listingTitle}</p>
          ) : null}
        </div>
      </section>

      {hasRelated ? (
        <section className="border-b border-border/60 py-10 sm:py-12">
          <div className="container mx-auto max-w-6xl px-4 sm:px-6">
            {landing.brand ? (
              <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  From{" "}
                  <Link
                    href={`${BRANDS_BASE}/${encodeURIComponent(landing.brand.slug)}`}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {landing.brand.name}
                  </Link>
                </p>
              </div>
            ) : landing.fallbackSectionTitle ? (
              <h2 className="mb-8 text-2xl font-bold text-foreground">{landing.fallbackSectionTitle}</h2>
            ) : null}

            {hasBrandPreview ? (
              <BrandMarketplaceListingsPreview
                liveListings={landing.brandLiveListings}
                soldListings={landing.brandSoldListings}
                favoritedListingIds={favoritedIds}
                isLoggedIn={!!user}
                viewerUserId={user?.id ?? null}
                viewAllActiveHref={landing.viewAllActiveHref}
                viewSoldHref={landing.viewSoldHref}
              />
            ) : (
              <>
                {landing.viewAllActiveHref ? (
                  <div className="mb-6 flex justify-center sm:justify-end">
                    <Button asChild variant="outline" className="rounded-full px-6">
                      <Link
                        href={landing.viewAllActiveHref}
                        prefetch={boardsBrowseLinkPrefetch(landing.viewAllActiveHref)}
                      >
                        View all
                      </Link>
                    </Button>
                  </div>
                ) : null}
                <RecentFeedClient
                  listings={landing.fallbackLiveListings}
                  favoritedListingIds={favoritedIds}
                  isLoggedIn={!!user}
                  viewerUserId={user?.id ?? null}
                />
              </>
            )}
          </div>
        </section>
      ) : null}

      {landing.browseBoards.length > 0 ? (
        <section className={`py-12 sm:py-16 ${hasRelated ? "bg-offwhite/50" : ""}`}>
          <div className="container mx-auto">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                While you&apos;re at it, check out other boards on Reswell
              </h2>
              <Button variant="outline" asChild className="shrink-0 rounded-full px-6 sm:shrink-0">
                <Link href="/boards" prefetch={boardsBrowseLinkPrefetch("/boards")}>
                  View all on /boards
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {landing.browseBoards.map((board) => (
                <HomePeerListingScrollTile
                  key={board.id}
                  layout="grid"
                  userId={user?.id ?? null}
                  isFavorited={favoritedIds.includes(board.id)}
                  listing={boardRowToPeerListing(board)}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  )
}
