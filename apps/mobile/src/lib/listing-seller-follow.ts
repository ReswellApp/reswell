import { useRouter } from "expo-router"
import { useAuthGate } from "@/lib/auth-gate"
import { useCallback, useState, type Dispatch, type SetStateAction } from "react"
import type { MobileListingCard, MobileListingCardSeller } from "@reswell/api-contract"
import { setFollow } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

export function patchListingSeller(
  listings: MobileListingCard[],
  sellerId: string,
  patch: Partial<MobileListingCardSeller>,
): MobileListingCard[] {
  return listings.map((listing) =>
    listing.seller?.id === sellerId ? { ...listing, seller: { ...listing.seller, ...patch } } : listing,
  )
}

/** Seller navigation and follow actions for single-column marketplace rows. */
export function useListingSellerFollow(setListings: Dispatch<SetStateAction<MobileListingCard[]>>) {
  const router = useRouter()
  const { session } = useAuth()
  const { requestAuth } = useAuthGate()
  const viewerId = session?.user?.id ?? null
  const [followBusyId, setFollowBusyId] = useState<string | null>(null)

  const openListing = useCallback(
    (listing: MobileListingCard) => {
      router.push({ pathname: "/listing/[id]", params: { id: listing.slug || listing.id } })
    },
    [router],
  )

  const openSeller = useCallback(
    (seller: MobileListingCardSeller) => {
      if (seller.seller_slug) {
        router.push({ pathname: "/profile/[slug]", params: { slug: seller.seller_slug } })
      }
    },
    [router],
  )

  const toggleFollow = useCallback(
    (seller: MobileListingCardSeller) => {
      requestAuth((accessToken) => {
      const next = !seller.following
      setFollowBusyId(seller.id)
      setFollow(accessToken, seller.id, next)
        .then(() => {
          setListings((current) => patchListingSeller(current, seller.id, { following: next }))
        })
        .catch(() => undefined)
        .finally(() => setFollowBusyId(null))
      })
    },
    [requestAuth, setListings],
  )

  return { viewerId, followBusyId, openListing, openSeller, toggleFollow }
}
