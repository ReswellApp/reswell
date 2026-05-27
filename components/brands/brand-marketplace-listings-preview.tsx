import Link from "next/link"
import { Button } from "@/components/ui/button"
import { RecentFeedClient, type RecentListing } from "@/components/recent-feed-client"

/**
 * Live + sold listing grids on `/brands/[slug]` and unavailable listing landings.
 * Matches brand profile listing layout (grid tiles, sold strip styling).
 */
export function BrandMarketplaceListingsPreview({
  liveListings,
  soldListings,
  favoritedListingIds,
  isLoggedIn,
  viewerUserId,
  viewAllActiveHref,
  viewSoldHref,
  viewAllActiveLabel = "View all",
  viewSoldLabel = "View sold",
}: {
  liveListings: RecentListing[]
  soldListings: RecentListing[]
  favoritedListingIds: string[]
  isLoggedIn: boolean
  viewerUserId: string | null
  viewAllActiveHref: string | null
  viewSoldHref: string | null
  viewAllActiveLabel?: string
  viewSoldLabel?: string
}) {
  if (liveListings.length === 0 && soldListings.length === 0) {
    return null
  }

  return (
    <>
      {liveListings.length > 0 ? (
        <>
          {viewAllActiveHref ? (
            <div className="mb-6 flex justify-center sm:justify-end">
              <Button asChild variant="outline" className="rounded-full px-6">
                <Link href={viewAllActiveHref}>{viewAllActiveLabel}</Link>
              </Button>
            </div>
          ) : null}
          <RecentFeedClient
            listings={liveListings}
            favoritedListingIds={favoritedListingIds}
            isLoggedIn={isLoggedIn}
            viewerUserId={viewerUserId}
          />
        </>
      ) : null}

      {soldListings.length > 0 ? (
        <div className={liveListings.length > 0 ? "mt-14" : undefined}>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Recently sold
            </h2>
            {viewSoldHref ? (
              <Button asChild variant="outline" className="rounded-full px-6 sm:shrink-0">
                <Link href={viewSoldHref}>{viewSoldLabel}</Link>
              </Button>
            ) : null}
          </div>
          <RecentFeedClient
            listings={soldListings}
            favoritedListingIds={favoritedListingIds}
            isLoggedIn={isLoggedIn}
            viewerUserId={viewerUserId}
            soldPresentation
          />
        </div>
      ) : null}
    </>
  )
}
