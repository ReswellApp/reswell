"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Check, CreditCard, Loader2, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { addCartItem } from "@/app/actions/cart"
import { peerListingCheckoutHref } from "@/lib/listing-href"
import { useOptionalAuthModal } from "@/components/auth/auth-modal-context"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { toast } from "sonner"
import {
  MakeOfferDialog,
  MakeOfferTriggerButton,
} from "@/components/features/listings/make-offer-dialog"

export type ListingMakeOfferConfig = {
  listingTitle: string
  listPrice: number
  minOfferAmount: number
  minOfferPct: number
  primaryImageUrl: string | null
  canPick: boolean
  canShip: boolean
  shippingFlatRate: number
}

export function ListingDetailPeerPurchaseActions({
  listingId,
  checkoutListingParam,
  section,
  isLoggedIn,
  makeOffer,
  agreedCheckoutItemUsd,
}: {
  listingId: string
  /** Slug or id for `/checkout?listing=` */
  checkoutListingParam: string
  section: "surfboards"
  isLoggedIn: boolean
  makeOffer?: ListingMakeOfferConfig
  /** When the buyer has an ACCEPTED offer, checkout uses this item price (listing stays at list price in the gallery). */
  agreedCheckoutItemUsd?: number | null
}) {
  const [loading, setLoading] = useState(false)
  const [cartAdded, setCartAdded] = useState(false)
  const [offerOpen, setOfferOpen] = useState(false)
  const authModal = useOptionalAuthModal()
  const router = useRouter()
  const pathname = usePathname()
  const here = pathname || "/"
  const checkoutHref = peerListingCheckoutHref(section, checkoutListingParam)

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
    if (!isLoggedIn) {
      const safe = safeRedirectPath(here)
      if (authModal) {
        authModal.openLogin(here)
      } else {
        router.push(`/auth/login?redirect=${encodeURIComponent(safe)}`)
      }
      return
    }
    setLoading(true)
    try {
      const r = await addCartItem(listingId)
      if (!r.ok) {
        toast.error(r.error ?? "Could not add to cart")
        return
      }
      setCartAdded(true)
      window.dispatchEvent(new CustomEvent("cartUpdated"))
      window.setTimeout(() => setCartAdded(false), 2000)
    } finally {
      setLoading(false)
    }
  }

  function openMakeOffer() {
    if (!isLoggedIn) {
      const safe = safeRedirectPath(here)
      if (authModal) {
        authModal.openLogin(here)
      } else {
        router.push(`/auth/login?redirect=${encodeURIComponent(safe)}`)
      }
      return
    }
    setOfferOpen(true)
  }

  return (
    <div className="flex flex-col gap-2">
      {agreedCheckoutItemUsd != null &&
      agreedCheckoutItemUsd > 0 &&
      Number.isFinite(agreedCheckoutItemUsd) ? (
        <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[13px] leading-snug text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-100">
          You accepted <span className="font-semibold tabular-nums">${agreedCheckoutItemUsd.toFixed(2)}</span> for
          this board. Buy now charges that price (plus shipping if you choose shipping).
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        {isLoggedIn ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-touch flex-1 gap-2 justify-center"
            disabled={loading}
            onClick={handleAddToCart}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
            ) : cartAdded ? (
              <Check className="h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden />
            )}
            {cartAdded ? "Added" : "Add to cart"}
          </Button>
        ) : (
          <Button variant="outline" size="lg" className="min-h-touch flex-1 gap-2 justify-center" asChild>
            <Link
              href={`/auth/login?redirect=${encodeURIComponent(safeRedirectPath(here))}`}
              prefetch={false}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                if (!authModal) return
                e.preventDefault()
                authModal.openLogin(here)
              }}
            >
              <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden />
              Add to cart
            </Link>
          </Button>
        )}

        <Button size="lg" className="min-h-touch flex-1 gap-2 justify-center" asChild>
          <Link href={checkoutHref} prefetch={false}>
            <CreditCard className="h-5 w-5 shrink-0" aria-hidden />
            Buy now
          </Link>
        </Button>
      </div>

      {makeOffer ? (
        <>
          <MakeOfferTriggerButton onClick={openMakeOffer} />
          <MakeOfferDialog
            listingId={listingId}
            listingTitle={makeOffer.listingTitle}
            listPrice={makeOffer.listPrice}
            minOfferAmount={makeOffer.minOfferAmount}
            minOfferPct={makeOffer.minOfferPct}
            primaryImageUrl={makeOffer.primaryImageUrl}
            canPick={makeOffer.canPick}
            canShip={makeOffer.canShip}
            shippingFlatRate={makeOffer.shippingFlatRate}
            isLoggedIn={isLoggedIn}
            open={offerOpen}
            onOpenChange={setOfferOpen}
          />
        </>
      ) : null}
    </div>
  )
}
