"use client"

import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCondition, formatCategory, formatBoardType, capitalizeWords } from "@/lib/listing-labels"
import { FavoriteButtonCardOverlay } from "@/components/favorite-button-card-overlay"
import { MessageListingButton } from "@/components/message-listing-button"
import { MapPin, Truck } from "lucide-react"

export interface RecentListing {
  id: string
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
  profiles?: { display_name?: string | null; avatar_url?: string | null; location?: string | null; sales_count?: number } | null
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
  switch (listing.section) {
    case "used":
      return `/used/${listing.id}`
    case "surfboards":
      return `/boards/${listing.id}`
    default:
      return `/used/${listing.id}`
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
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            className="group overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col"
          >
            <Link href={href} className="flex-1 flex flex-col">
              <div className="aspect-[4/5] relative bg-muted overflow-hidden">
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
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  <Badge className="bg-black/70 text-white border-0">
                    {formatCondition(listing.condition)}
                  </Badge>
                  {listing.section === "surfboards" && listing.board_type ? (
                    <Badge className="bg-black/70 text-white border-0">
                      {formatBoardType(listing.board_type)}
                    </Badge>
                  ) : listing.categories?.name ? (
                    <Badge className="bg-black/70 text-white border-0">
                      {formatCategory(listing.categories.name)}
                    </Badge>
                  ) : null}
                </div>
                <Badge className="absolute bottom-2 right-2 bg-black/70 text-white border-0">
                  {isInPersonOnly ? (
                    <>
                      <MapPin className="h-3 w-3 mr-1" />
                      In-Person Only
                    </>
                  ) : (
                    <>
                      <Truck className="h-3 w-3 mr-1" />
                      Ships
                    </>
                  )}
                </Badge>
                <FavoriteButtonCardOverlay
                  listingId={listing.id}
                  initialFavorited={favoritedListingIds.includes(listing.id)}
                  isLoggedIn={isLoggedIn}
                />
              </div>
              <CardContent className="p-4">
                <h3 className="font-medium line-clamp-2">{capitalizeWords(listing.title)}</h3>
                {listing.section === "surfboards" && listing.board_length && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {listing.board_length}
                  </p>
                )}
                <p className="text-xl font-bold text-primary mt-2">
                  ${listing.price.toFixed(2)}
                </p>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                  <MapPin className="h-3 w-3" />
                  {locationText}
                </div>
              </CardContent>
            </Link>
            <div className="px-4 pb-4 pt-0">
              <MessageListingButton
                listingId={listing.id}
                sellerId={listing.user_id}
                redirectPath={href}
              />
            </div>
          </Card>
        )
      })}
    </div>
  )
}
