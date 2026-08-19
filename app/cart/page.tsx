import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { addCartItem, getCartPageItems } from "@/app/actions/cart"
import { getFavoriteListingIds } from "@/app/actions/favorites"
import { CartEmptyState } from "@/components/features/cart/cart-empty-state"
import { CartPageView } from "@/components/cart-page-view"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { getFavoriteListingsForCartCarousel } from "@/lib/db/favorites"
import { cartAddListingHref } from "@/lib/listing-href"
import { pageSeoMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { isUUID } from "@/lib/slugify"

export const metadata: Metadata = pageSeoMetadata({
  title: "Cart — Reswell",
  description: "Review saved marketplace listings and continue to checkout.",
  path: "/cart",
  robots: { index: false, follow: false },
})

function firstSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value
  if (Array.isArray(value) && typeof value[0] === "string") return value[0]
  return null
}

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string | string[] }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const qs = await searchParams
  const addRaw = firstSearchParam(qs.add)?.trim() ?? ""
  const addListingId = isUUID(addRaw) ? addRaw : null

  if (addListingId) {
    if (!user) {
      redirect(`/auth/login?redirect=${encodeURIComponent(safeRedirectPath(cartAddListingHref(addListingId)))}`)
    }
    const added = await addCartItem(addListingId)
    if (!added.ok) {
      console.error("[cart] add-from-query failed", {
        listingId: addListingId,
        userId: user.id,
        error: added.error,
        timestamp: new Date().toISOString(),
      })
    }
    redirect("/cart")
  }

  if (!user) {
    return <CartEmptyState />
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
