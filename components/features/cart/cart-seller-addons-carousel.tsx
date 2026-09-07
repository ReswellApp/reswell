"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { HomeListingScrollRow } from "@/components/features/home/home-listing-scroll-row"
import {
  HomePeerListingScrollTile,
  type HomePeerScrollListing,
} from "@/components/features/home/home-peer-listing-scroll-tile"
import { Button } from "@/components/ui/button"
import type { CartSellerAddonCarouselItem } from "@/lib/services/cartSellerAddons"

function toHomePeerListing(l: CartSellerAddonCarouselItem): HomePeerScrollListing {
  return {
    id: l.id,
    slug: l.slug,
    user_id: l.user_id,
    title: l.title,
    price: l.price,
    status: l.status,
    section: l.section,
    local_pickup: l.local_pickup,
    shipping_available: l.shipping_available,
    listing_images: l.listing_images,
    categories: l.categories,
    board_type: l.board_type,
    condition: l.condition,
  }
}

export function CartSellerAddonsCarousel({
  initialListings,
  subtitle,
  viewAllHref,
  viewAllLabel,
  buyerId,
  favoritedListingIds,
}: {
  initialListings: CartSellerAddonCarouselItem[]
  subtitle: string
  viewAllHref: string | null
  viewAllLabel: string
  buyerId: string
  favoritedListingIds: string[]
}) {
  const router = useRouter()

  if (initialListings.length === 0) {
    return null
  }

  return (
    <section
      className="mt-12 border-t border-neutral-200 pt-16 dark:border-white/10"
      aria-labelledby="cart-bundle-addons-heading"
    >
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 id="cart-bundle-addons-heading" className="text-2xl font-bold">
            Bundle and save
          </h2>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        {viewAllHref ? (
          <Button variant="outline" asChild className="shrink-0">
            <Link href={viewAllHref}>
              {viewAllLabel}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>

      <HomeListingScrollRow uniformCardHeights>
        {initialListings.map((row) => {
          const listing = toHomePeerListing(row)
          return (
            <HomePeerListingScrollTile
              key={row.id}
              listing={listing}
              userId={buyerId}
              isFavorited={favoritedListingIds.includes(row.id)}
              onFavoritedChange={(favorited) => {
                if (!favorited) {
                  router.refresh()
                }
              }}
              footerTrailing={
                <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                  {row.pairsWithLabel}
                </p>
              }
            />
          )
        })}
      </HomeListingScrollRow>
    </section>
  )
}
