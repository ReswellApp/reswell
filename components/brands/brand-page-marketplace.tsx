import type { ReactNode } from "react"
import Link from "next/link"
import { RecentFeedClient, type RecentListing } from "@/components/recent-feed-client"
import { SaveEntitySearchCta } from "@/components/features/saved-search/save-entity-search-cta"
import { Button } from "@/components/ui/button"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import {
  brandActiveListingsBrowseHref,
  brandPageHref,
  brandPageResultsLabel,
  brandSoldListingsBrowseHref,
  type BrandPageTab,
} from "@/lib/brands/routes"
import { cn } from "@/lib/utils"

const TAB_ITEMS: { id: BrandPageTab; label: string }[] = [
  { id: "listings", label: "Listings" },
  { id: "feed", label: "Feed" },
]

export function BrandPageMarketplace({
  brandSlug,
  brandName,
  criteria,
  initialSavedSearchId,
  initialTab,
  listings,
  soldListings,
  listingsCapped,
  soldCapped,
  favoritedListingIds,
  isLoggedIn,
  viewerUserId,
}: {
  brandSlug: string
  brandName: string
  criteria: BoardSavedSearchCriteria
  initialSavedSearchId: string | null
  initialTab: BrandPageTab
  listings: RecentListing[]
  soldListings: RecentListing[]
  listingsCapped: boolean
  soldCapped: boolean
  favoritedListingIds: string[]
  isLoggedIn: boolean
  viewerUserId: string | null
}) {
  const tab = initialTab
  const isFeed = tab === "feed"
  const count = isFeed ? soldListings.length : listings.length
  const capped = isFeed ? soldCapped : listingsCapped
  const viewAllHref = isFeed
    ? brandSoldListingsBrowseHref({ slug: brandSlug })
    : brandActiveListingsBrowseHref({ slug: brandSlug })

  return (
    <div>
      <p className="mt-2 text-base text-muted-foreground sm:text-lg">
        {brandPageResultsLabel(count, { tab, capped })}
      </p>

      <nav aria-label="Brand listings" className="mt-6 border-b border-border/80">
        <ul className="flex gap-x-6">
          {TAB_ITEMS.map((item) => {
            const active = item.id === tab
            return (
              <li key={item.id}>
                <Link
                  href={brandPageHref(brandSlug, item.id)}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px inline-flex border-b-2 py-3 text-sm font-medium transition-colors",
                    active
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="mt-6 sm:mt-8">
        {isFeed ? (
          soldListings.length > 0 ? (
            <RecentFeedClient
              listings={soldListings}
              favoritedListingIds={favoritedListingIds}
              isLoggedIn={isLoggedIn}
              viewerUserId={viewerUserId}
              soldPresentation
            />
          ) : (
            <BrandPageEmpty>
              No recently sold {brandName} listings yet.
            </BrandPageEmpty>
          )
        ) : listings.length > 0 ? (
          <RecentFeedClient
            listings={listings}
            favoritedListingIds={favoritedListingIds}
            isLoggedIn={isLoggedIn}
            viewerUserId={viewerUserId}
          />
        ) : (
          <SaveEntitySearchCta
            heading={`No ${brandName} listings for sale right now`}
            description={`Save this brand and we'll email you when new ${brandName} gear is listed on Reswell.`}
            criteria={criteria}
            label="Save this brand"
            savedLabel="Brand saved"
            savedSearchLabel={brandName}
            successTitle="Brand saved"
            successDescription={`We'll email you when new ${brandName} gear is listed on Reswell.`}
            isLoggedIn={isLoggedIn}
            initialSavedSearchId={initialSavedSearchId}
          />
        )}
      </div>

      {capped ? (
        <div className="mt-8 flex justify-center">
          <Button asChild variant="outline" className="rounded-full px-6">
            <Link href={viewAllHref}>{isFeed ? "View all sold" : "View all listings"}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function BrandPageEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl bg-neutral-100 px-6 py-12 text-center text-sm text-muted-foreground sm:px-10 sm:py-16 sm:text-base">
      {children}
    </p>
  )
}
