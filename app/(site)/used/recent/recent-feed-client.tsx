"use client"

import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCondition, formatCategory, formatBoardType, capitalizeWords } from "@/lib/listing-labels"
import { FavoriteButtonCardOverlay } from "@/components/favorite-button-card-overlay"
import { MapPin, Truck } from "lucide-react"
import { listingProductCardGridClassName } from "@/lib/listing-card-styles"

export interface RecentListing {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  condition: string
  section: string
  city?: string | null
  state?: string | null
  shipping_available?: boolean
  board_type?: string | null
  board_length?: string | null
  listing_images?: { url: string; is_primary?: boolean }[] | null
  profiles?: { display_name?: string | null; avatar_url?: string | null; location?: string | null; sales_count?: number; shop_verified?: boolean } | null
  categories?: { name?: string | null; slug?: string | null } | null
}

interface RecentFeedClientProps {
  listings: RecentListing[]
  favoritedListingIds: string[]
  isLoggedIn: boolean
  /** Override default empty state copy (e.g. search results). */
  emptyMessage?: string
}

function getListingHref(listing: RecentListing): string {
  const id = listing.slug || listing.id
  switch (listing.section) {
    case "used":
      return `/used/${id}`
    case "surfboards":
      return `/boards/${id}`
    default:
      return `/used/${id}`
  }
}

export function RecentFeedClient({
  listings,
  favoritedListingIds,
  isLoggedIn,
  emptyMessage,
}: RecentFeedClientProps) {
  if (!listings.length) {
    return (
      <p className="text-center text-muted-foreground py-12">
        {emptyMessage ?? "No recent listings yet. Check back soon."}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {listings.map((listing) => {
        const primaryImage =
          listing.listing_images?.find((img) => img.is_primary) || listing.listing_images?.[0]
        const href = getListingHref(listing)
        const locationText =
          listing.city && listing.state
            ? `${listing.city}, ${listing.state}`
            : listing.profiles?.location || "Location not set"
        const isInPersonOnly = listing.section === "surfboards" || !listing.shipping_available
        return (
          <Card
            key={listing.id}
            className={listingProductCardGridClassName}
          >
            <Link href={href} className="min-w-0 flex-1 flex flex-col">
              <div className="aspect-[3/4] w-full relative bg-muted overflow-hidden">
                {primaryImage?.url ? (
                  <Image
                    src={primaryImage.url || "/placeholder.svg"}
                    alt={capitalizeWords(listing.title)}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    style={{ objectFit: "cover" }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    No Image
                  </div>
                )}
                <FavoriteButtonCardOverlay
                  listingId={listing.id}
                  initialFavorited={favoritedListingIds.includes(listing.id)}
                  isLoggedIn={isLoggedIn}
                />
              </div>
              <CardContent className="min-w-0 p-3">
                <h3 className="text-sm font-medium line-clamp-2 min-h-[2.8em]">{capitalizeWords(listing.title)}</h3>
                {listing.section === "surfboards" && listing.board_length && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {listing.board_length}
                  </p>
                )}
                <p className="text-base font-bold text-black dark:text-white mt-2">
                  ${listing.price.toFixed(2)}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                  <MapPin className="h-3 w-3" />
                  {locationText}
                </div>
              </CardContent>
            </Link>
          </Card>
        )
      })}
    </div>
  )
}
