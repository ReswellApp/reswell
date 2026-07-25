"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Check, Loader2, ShoppingCart } from "lucide-react"
import type * as React from "react"

import { Button } from "@/components/ui/button"
import { addCartItem } from "@/app/actions/cart"
import { trackMetaAddToCart } from "@/lib/meta/pixel-events"
import { collectMetaClientBrowserSignals } from "@/lib/meta/collect-client-browser-signals"
import { peerListingCheckoutHref } from "@/lib/listing-href"
import { prefetchStripeCheckout } from "@/lib/stripe/prefetch-stripe-checkout"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import { useOptionalAuthModal } from "@/components/auth/auth-modal-context"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { toast } from "sonner"
import {
  MakeOfferDialog,
  MakeOfferTriggerButton,
} from "@/components/features/listings/make-offer-dialog"
import type { OfferShippingCostMode } from "@/lib/offer-listing-shipping"
import type { ListingExclusivePurchaseAccess } from "@/lib/services/listingBuyerExclusiveWindow"

export type ListingMakeOfferConfig = {
  listingTitle: string
  listPrice: number
  minOfferAmount: number
  minOfferPct: number
  primaryImageUrl: string | null
  canPick: boolean
  canShip: boolean
  shippingFlatRate: number
  shippingCostMode?: OfferShippingCostMode | null
}

export type ListingDetailPeerPurchaseActionsProps = {
  listingId: string
  /** Slug or id for `/checkout?listing=` */
  checkoutListingParam: string
  section: PeerListingSection
  isLoggedIn: boolean
  makeOffer?: ListingMakeOfferConfig
  /** When the buyer has an ACCEPTED offer, checkout uses this item price (listing stays at list price in the gallery). */
  agreedCheckoutItemUsd?: number | null
  /** Renders beside “Make an offer” (e.g. share roundel). */
  offerRowTrailingSlot?: React.ReactNode
  exclusivePurchaseAccess?: ListingExclusivePurchaseAccess
}

export function ListingDetailPeerPurchaseActions({
  listingId,
  checkoutListingParam,
  section,
  isLoggedIn,
  makeOffer,
  agreedCheckoutItemUsd,
  offerRowTrailingSlot,
  exclusivePurchaseAccess = { kind: "open" },
}: ListingDetailPeerPurchaseActionsProps) {
  const [loading, setLoading] = useState(false)
  const [cartAdded, setCartAdded] = useState(false)
  const [offerOpen, setOfferOpen] = useState(false)
  const authModal = useOptionalAuthModal()
  const router = useRouter()
  const pathname = usePathname()
  const here = pathname || "/"
  const checkoutHref = peerListingCheckoutHref(section, checkoutListingParam)

  useEffect(() => {
    if (!isLoggedIn) return
    void prefetchStripeCheckout()
  }, [isLoggedIn])

  function openLoginGate(redirect: string = here) {
    if (authModal) {
      authModal.openLogin(redirect)
    } else {
      router.push(`/auth/login?redirect=${encodeURIComponent(safeRedirectPath(redirect))}`)
    }
  }

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
    if (!isLoggedIn) {
      openLoginGate(here)
      return
    }
    setLoading(true)
    try {
      const browserSignals = await collectMetaClientBrowserSignals().catch(() => ({
        fbc: null,
        fbp: null,
      }))
      const r = await addCartItem(listingId, {
        fbc: browserSignals.fbc ?? undefined,
        fbp: browserSignals.fbp ?? undefined,
      })
      if (!r.ok) {
        toast.error(r.error ?? "Could not add to cart")
        return
      }
      trackMetaAddToCart({
        contentId: listingId,
        value: r.value,
        contentName: r.contentName,
        eventId: r.metaEventId,
      })
      setCartAdded(true)
      window.dispatchEvent(new CustomEvent("cartUpdated"))
      window.setTimeout(() => setCartAdded(false), 2000)
    } finally {
      setLoading(false)
    }
  }

  function openMakeOffer() {
    if (!isLoggedIn) {
      openLoginGate(here)
      return
    }
    setOfferOpen(true)
  }

  const purchaseBlocked =
    exclusivePurchaseAccess.kind === "blocked_for_viewer" ||
    exclusivePurchaseAccess.kind === "blocked_sign_in"
  const exclusiveForViewer = exclusivePurchaseAccess.kind === "exclusive_for_viewer"

  return (
    <div className="flex flex-col gap-[10px]">
      {exclusiveForViewer ? (
        <p className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.08] px-4 py-3 text-[13px] leading-snug text-sky-950 dark:border-sky-400/25 dark:bg-sky-500/10 dark:text-sky-50">
          You have exclusive access to buy this item again through{" "}
          <span className="font-semibold">{exclusivePurchaseAccess.expiresAtLabel}</span>.
        </p>
      ) : null}
      {purchaseBlocked ? (
        <p className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.08] px-4 py-3 text-[13px] leading-snug text-amber-950 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-50">
          {exclusivePurchaseAccess.kind === "blocked_sign_in"
            ? `This item is reserved for the original buyer until ${exclusivePurchaseAccess.expiresAtLabel}. Sign in with that account to purchase.`
            : `This item is reserved for the original buyer until ${exclusivePurchaseAccess.expiresAtLabel}.`}
        </p>
      ) : null}
      {agreedCheckoutItemUsd != null &&
      agreedCheckoutItemUsd > 0 &&
      Number.isFinite(agreedCheckoutItemUsd) ? (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-3 text-[13px] leading-snug text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-100">
          You accepted <span className="font-semibold tabular-nums">${agreedCheckoutItemUsd.toFixed(2)}</span> for
          this board. Buy now charges that price and uses the delivery method from your offer.
        </p>
      ) : null}
      {!purchaseBlocked ? (
      <div className="flex flex-col gap-[10px]">
        {isLoggedIn ? (
          <Button
            size="lg"
            className="min-h-[52px] w-full justify-center rounded-xl border-0 bg-[#5574AD] px-6 text-[15px] font-semibold text-white shadow-none hover:bg-[#5574AD]/90 hover:text-white dark:bg-[#5574AD] dark:hover:bg-[#5574AD]/90"
            asChild
          >
            <Link href={checkoutHref} prefetch>
              Buy it now
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="min-h-[52px] w-full justify-center rounded-xl border-0 bg-[#5574AD] px-6 text-[15px] font-semibold text-white shadow-none hover:bg-[#5574AD]/90 hover:text-white dark:bg-[#5574AD] dark:hover:bg-[#5574AD]/90"
            onClick={() => openLoginGate(checkoutHref)}
          >
            Buy it now
          </Button>
        )}
        {isLoggedIn ? (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="min-h-[52px] w-full justify-center rounded-xl border-0 bg-[#f2f3f5] text-[15px] font-semibold text-foreground shadow-none hover:bg-[#e8e9ec] dark:bg-secondary dark:hover:bg-secondary/80"
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
          <Button
            variant="secondary"
            size="lg"
            className="min-h-[52px] w-full justify-center rounded-xl border-0 bg-[#f2f3f5] text-[15px] font-semibold text-foreground shadow-none hover:bg-[#e8e9ec] dark:bg-secondary dark:hover:bg-secondary/80"
            asChild
          >
            <Link
              href={`/auth/login?redirect=${encodeURIComponent(safeRedirectPath(here))}`}
              prefetch={false}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                if (!authModal) return
                e.preventDefault()
                openLoginGate(here)
              }}
            >
              <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden />
              Add to cart
            </Link>
          </Button>
        )}
      </div>
      ) : null}

      {!purchaseBlocked && makeOffer ? (
        <>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <MakeOfferTriggerButton onClick={openMakeOffer} />
            </div>
            {offerRowTrailingSlot ? <div className="shrink-0">{offerRowTrailingSlot}</div> : null}
          </div>
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
            shippingCostMode={makeOffer.shippingCostMode ?? null}
            isLoggedIn={isLoggedIn}
            open={offerOpen}
            onOpenChange={setOfferOpen}
          />
        </>
      ) : null}
    </div>
  )
}
