"use client"

import { useTransition, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import { useScrollToTopOnSearchParam } from "@/hooks/use-scroll-to-top-on-search-param"
import { RecentFeedClient } from "@/components/recent-feed-client"
import type { RecentListing } from "@/components/recent-feed-client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { saleFeedHref } from "@/lib/sale-feed"
import { MarketplaceFeedSaleStatsBanner } from "@/components/features/marketplace/marketplace-feed-stats-banner"

type SaleFeedPanelProps = {
  listings: RecentListing[]
  page: number
  totalPages: number
  totalCount: number
}

function preventBlurBeforeClick(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault()
}

export function SaleFeedPanel({
  listings,
  page,
  totalPages,
  totalCount,
}: SaleFeedPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  useScrollToTopOnSearchParam("page")

  const goToPage = (pageNum: number) => {
    startTransition(() => {
      router.push(saleFeedHref(pageNum))
    })
  }

  return (
    <div
      className={cn("transition-opacity duration-200", isPending && "opacity-70")}
      aria-busy={isPending}
    >
      <MarketplaceFeedSaleStatsBanner totalCount={totalCount} />

      <RecentFeedClient
        listings={listings}
        favoritedListingIds={[]}
        isLoggedIn={false}
        viewerUserId={null}
        hydrateOwnFavorites
        emptyMessage="No marked-down listings right now. Check back soon."
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
