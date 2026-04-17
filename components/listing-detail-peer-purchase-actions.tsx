"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { CreditCard, Loader2, ShoppingCart } from "lucide-react"
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
}: {
  listingId: string
  /** Slug or id for `/checkout?listing=` */
  checkoutListingParam: string
  section: "surfboards"
  isLoggedIn: boolean
  makeOffer?: ListingMakeOfferConfig
}) {
  const [loading, setLoading] = useState(false)
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
      toast.success("Saved to cart")
      window.dispatchEvent(new CustomEvent("cartUpdated"))
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
            ) : (
              <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden />
            )}
            Add to cart
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

        {isLoggedIn ? (
          <Button size="lg" className="min-h-touch flex-1 gap-2 justify-center" asChild>
            <Link href={checkoutHref} prefetch={false}>
              <CreditCard className="h-5 w-5 shrink-0" aria-hidden />
              Buy now
            </Link>
          </Button>
        ) : (
          <Button size="lg" className="min-h-touch flex-1 gap-2 justify-center" asChild>
            <Link
              href={`/auth/login?redirect=${encodeURIComponent(safeRedirectPath(checkoutHref))}`}
              prefetch={false}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                if (!authModal) return
                e.preventDefault()
                authModal.openLogin(checkoutHref)
              }}
            >
              <CreditCard className="h-5 w-5 shrink-0" aria-hidden />
              Buy now
            </Link>
          </Button>
        )}
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
