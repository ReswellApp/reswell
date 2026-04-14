import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCartPageItems } from "@/app/actions/cart"
import { getFavoriteListingIds } from "@/app/actions/favorites"
import { CartPageView } from "@/components/cart-page-view"
import { getFavoriteListingsForCartCarousel } from "@/lib/db/favorites"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata: Metadata = pageSeoMetadata({
  title: "Cart — Reswell",
  description: "Review saved marketplace listings and continue to checkout.",
  path: "/cart",
  robots: { index: false, follow: false },
})

export default async function CartPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent("/cart")}`)
  }

  const { items, error } = await getCartPageItems()
  const cartListingIds = items.map((row) => row.listing.id)

  const [{ favorites: favoritedListingIds }, carouselResult] = await Promise.all([
    getFavoriteListingIds(),
    getFavoriteListingsForCartCarousel(supabase, user.id, { excludeListingIds: cartListingIds }),
  ])

  return (
    <CartPageView
      initialItems={items}
      loadError={error}
      favoritedListingIds={favoritedListingIds}
      favoriteCarouselListings={carouselResult.listings}
      buyerId={user.id}
    />
  )
}
