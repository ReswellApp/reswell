"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { HomeListingScrollRow, HomePeerListingScrollTile } from "@/components/features/home"
import type { HomePeerScrollListing } from "@/components/features/home"
import { Button } from "@/components/ui/button"
import type { CartCarouselFavoriteListing } from "@/lib/db/favorites"

export type { CartCarouselFavoriteListing }

function toHomePeerListing(l: CartCarouselFavoriteListing): HomePeerScrollListing {
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
  }
}

export function CartFavoritesCarousel({
  initialListings,
  buyerId,
}: {
  initialListings: CartCarouselFavoriteListing[]
  buyerId: string
}) {
  const router = useRouter()
  const [listings, setListings] = useState(initialListings)

  useEffect(() => {
    setListings(initialListings)
  }, [initialListings])

  if (listings.length === 0) {
    return null
  }

  return (
    <section
      className="mt-12 border-t border-neutral-200 pt-16 dark:border-white/10"
      aria-labelledby="cart-favorites-heading"
    >
      {/* Same header + row pattern as “Recently added surfboards” (`app/page.tsx`). */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 id="cart-favorites-heading" className="text-2xl font-bold">
            From your favorites
          </h2>
          <p className="text-muted-foreground">Boards you&apos;ve saved for later</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/favorites">
            View all
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <HomeListingScrollRow uniformCardHeights>
        {listings.map((row) => {
          const listing = toHomePeerListing(row)
          return (
            <HomePeerListingScrollTile
              key={row.id}
              listing={listing}
              userId={buyerId}
              isFavorited
              onFavoritedChange={(favorited) => {
                if (!favorited) {
                  setListings((prev) => prev.filter((x) => x.id !== row.id))
                  router.refresh()
                }
              }}
            />
          )
        })}
      </HomeListingScrollRow>
    </section>
  )
}
