"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Check, Loader2, ShoppingCart } from "lucide-react"
import type * as React from "react"

import { Button } from "@/components/ui/button"
import { addCartItem } from "@/app/actions/cart"
import { trackMetaAddToCart } from "@/lib/meta/pixel-events"
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
import {
  ListingVariantPicker,
  type ListingVariantOption,
} from "@/components/features/listings/listing-variant-picker"

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
  hasVariants = false,
  makeOffer,
  agreedCheckoutItemUsd,
  offerRowTrailingSlot,
}: {
  listingId: string
  /** Slug or id for `/checkout?listing=` */
  checkoutListingParam: string
  section: PeerListingSection
  isLoggedIn: boolean
  /** When true, buyer must pick a variant before checkout. */
  hasVariants?: boolean
  makeOffer?: ListingMakeOfferConfig
  /** When the buyer has an ACCEPTED offer, checkout uses this item price (listing stays at list price in the gallery). */
  agreedCheckoutItemUsd?: number | null
  /** Renders beside “Make an offer” (e.g. share roundel). */
  offerRowTrailingSlot?: React.ReactNode
}) {
  const [loading, setLoading] = useState(false)
  const [cartAdded, setCartAdded] = useState(false)
  const [offerOpen, setOfferOpen] = useState(false)
  const [variants, setVariants] = useState<ListingVariantOption[]>([])
  const [variantsLoading, setVariantsLoading] = useState(hasVariants)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const authModal = useOptionalAuthModal()
  const router = useRouter()
  const pathname = usePathname()
  const here = pathname || "/"

  useEffect(() => {
    if (!hasVariants) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/listings/${listingId}/variants`)
        const json = (await res.json()) as { data?: { variants: ListingVariantOption[] } }
        if (cancelled) return
        const loaded = json.data?.variants ?? []
        setVariants(loaded)
        const inStock = loaded.filter((v) => v.in_stock && v.available > 0)
        if (inStock.length === 1) setSelectedVariantId(inStock[0]!.id)
      } finally {
        if (!cancelled) setVariantsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hasVariants, listingId])

  const checkoutHref = useMemo(() => {
    const base = peerListingCheckoutHref(section, checkoutListingParam)
    if (!selectedVariantId) return base
    const sep = base.includes("?") ? "&" : "?"
    return `${base}${sep}variant_id=${encodeURIComponent(selectedVariantId)}`
  }, [section, checkoutListingParam, selectedVariantId])

  const needsVariant = hasVariants && variants.filter((v) => v.in_stock && v.available > 0).length > 1
  const checkoutBlocked = needsVariant && !selectedVariantId

  useEffect(() => {
    if (!isLoggedIn) return
    void prefetchStripeCheckout()
  }, [isLoggedIn])

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
    <div className="flex flex-col gap-[10px]">
      {hasVariants ? (
        variantsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading options…
          </div>
        ) : variants.length > 0 ? (
          <ListingVariantPicker
            variants={variants}
            value={selectedVariantId}
            onChange={setSelectedVariantId}
          />
        ) : null
      ) : null}
      {agreedCheckoutItemUsd != null &&
      agreedCheckoutItemUsd > 0 &&
      Number.isFinite(agreedCheckoutItemUsd) ? (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-3 text-[13px] leading-snug text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-100">
          You accepted <span className="font-semibold tabular-nums">${agreedCheckoutItemUsd.toFixed(2)}</span> for
          this board. Buy now charges that price (plus shipping if you choose shipping).
        </p>
      ) : null}
      <div className="flex flex-col gap-[10px]">
        <Button
          size="lg"
          className="min-h-[52px] w-full justify-center rounded-xl border-0 bg-[#5574AD] px-6 text-[15px] font-semibold text-white shadow-none hover:bg-[#5574AD]/90 hover:text-white dark:bg-[#5574AD] dark:hover:bg-[#5574AD]/90"
          asChild={!checkoutBlocked}
          disabled={checkoutBlocked}
          onClick={
            checkoutBlocked
              ? () => toast.error("Select an option before checkout")
              : undefined
          }
        >
          {checkoutBlocked ? (
            <span>Buy it now</span>
          ) : (
            <Link href={checkoutHref} prefetch>
              Buy it now
            </Link>
          )}
        </Button>
        {hasVariants ? (
          <p className="text-xs text-muted-foreground">
            Multi-option items checkout one variant at a time — use Buy it now.
          </p>
        ) : isLoggedIn ? (
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
                authModal.openLogin(here)
              }}
            >
              <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden />
              Add to cart
            </Link>
          </Button>
        )}
      </div>

      {makeOffer ? (
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
            isLoggedIn={isLoggedIn}
            open={offerOpen}
            onOpenChange={setOfferOpen}
          />
        </>
      ) : null}
    </div>
  )
}
