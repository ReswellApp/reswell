import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getFavoriteListingIds } from "@/app/actions/favorites"
import { ShopNewListingStandardTile } from "@/components/features/marketplace/shop-new-listing-standard-tile"
import { fetchReswellShopBrowseListings } from "@/lib/db/reswell-shop-listings"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata: Metadata = pageSeoMetadata({
  title: "Shop from Reswell — New gear",
  description:
    "Buy new surf gear fulfilled by Reswell. Same checkout as the marketplace — stocked inventory, sold and shipped by Reswell.",
  path: "/reswell/shop",
})

export const revalidate = 60

export default async function ReswellShopPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [listings, favoritesResult] = await Promise.all([
    fetchReswellShopBrowseListings(supabase),
    user ? getFavoriteListingIds() : Promise.resolve({ favorites: [] as string[] }),
  ])
  const favoritedIds = favoritesResult.favorites

  return (
    <main className="flex-1 bg-background">
      <div className="container mx-auto px-4 py-10 sm:px-6 lg:py-14">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium tracking-wide text-muted-foreground">Reswell</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Shop from Reswell
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            New items fulfilled by Reswell — add to cart and check out the same way as marketplace
            boards.
          </p>
        </header>

        {listings.length === 0 ? (
          <div className="mx-auto mt-16 max-w-md text-center">
            <p className="text-[15px] text-muted-foreground">
              Nothing in stock right now. Check back soon, or browse used boards from the community.
            </p>
            <Link
              href="/boards"
              className="mt-6 inline-flex text-[15px] font-medium text-foreground underline underline-offset-4"
            >
              Browse surfboards
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {listings.map((listing) => (
              <ShopNewListingStandardTile
                key={listing.id}
                layout="grid"
                listing={{
                  id: listing.id,
                  slug: listing.slug,
                  title: listing.title,
                  price: listing.price,
                  listing_images: listing.listing_images,
                }}
                stockQuantity={listing.stock_quantity}
                userId={user?.id ?? null}
                isFavorited={favoritedIds.includes(listing.id)}
                categoryName={null}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
