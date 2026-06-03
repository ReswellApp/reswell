"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useScrollToTopOnSearchParam } from "@/hooks/use-scroll-to-top-on-search-param"
import { RecentFeedClient } from "@/components/recent-feed-client"
import type { RecentListing } from "@/components/recent-feed-client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { marketplaceFeedHref } from "@/lib/marketplace-feed-tab"
import { MarketplaceFeedNewListingsStatsBanner } from "@/components/features/marketplace/marketplace-feed-stats-banner"

type NewListingsFeedPanelProps = {
  listings: RecentListing[]
  favoritedListingIds: string[]
  viewerUserId: string | null
  page: number
  totalPages: number
  totalCount: number
}

function preventBlurBeforeClick(event: React.MouseEvent<HTMLButtonElement>) {
  event.preventDefault()
}

export function NewListingsFeedPanel({
  listings,
  favoritedListingIds,
  viewerUserId,
  page,
  totalPages,
  totalCount,
}: NewListingsFeedPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  useScrollToTopOnSearchParam("page")

  const goToPage = (pageNum: number) => {
    startTransition(() => {
      router.push(marketplaceFeedHref("new", { page: pageNum <= 1 ? undefined : pageNum }))
    })
  }

  return (
    <div
      className={cn("transition-opacity duration-200", isPending && "opacity-70")}
      aria-busy={isPending}
    >
      <MarketplaceFeedNewListingsStatsBanner totalCount={totalCount} />

      <RecentFeedClient
        listings={listings}
        favoritedListingIds={favoritedListingIds}
        isLoggedIn={!!viewerUserId}
        viewerUserId={viewerUserId}
        emptyMessage="No active listings right now. Check back soon or browse surfboards."
      />

      {totalPages > 1 ? (
        <div className="mt-8 flex justify-center gap-2">
          {page > 1 ? (
            <Button
              type="button"
              variant="outline"
              onMouseDown={preventBlurBeforeClick}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </Button>
          ) : null}
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Button
              type="button"
              variant="outline"
              onMouseDown={preventBlurBeforeClick}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
