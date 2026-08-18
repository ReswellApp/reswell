"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Landmark, Link2, Plus, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  consumeJustPublishedListingMarker,
  type JustPublishedListingMarker,
} from "@/lib/sell-flow/just-published"
import {
  computeListingEnrichmentGaps,
  type ListingEnrichmentGap,
} from "@/lib/sell-flow/listing-enrichment"
import { peerListingEditHref } from "@/lib/peer-listing-sections"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"
import { setSellEntryPoint } from "@/lib/sell-flow/sell-entry-point"
import { cn } from "@/lib/utils"

/** Sell entry per listing section for the "List another" CTA. */
function sellAgainHref(section: string): string {
  switch (section) {
    case "surfboards":
      return SURFBOARD_SELL_BOARDS_CREATE_HREF
    case "fins":
      return "/sell/fins?new=1"
    case "wetsuits":
      return "/sell/wetsuits"
    case "magazines":
      return "/sell/magazines"
    case "apparel":
      return "/sell/apparel"
    case "boardbags":
      return "/sell/boardbags"
    case "surfpacks":
      return "/sell/surfpacks"
    case "leashes":
      return "/sell/leashes"
    case "accessories":
      return "/sell/accessories"
    default:
      return "/sell"
  }
}

/**
 * One-time "your listing is live" moment on the listing detail page after a
 * fresh publish. The seller lands on their real, live listing (the payoff),
 * with a share link, a "list another" prompt, and — when payouts aren't set
 * up yet — a non-blocking Stripe Connect nudge so payday isn't a surprise.
 */
export function ListingPublishedCelebration({ listingParam }: { listingParam: string }) {
  const [marker, setMarker] = useState<JustPublishedListingMarker | null>(null)
  const [visible, setVisible] = useState(false)
  const [payoutsNeedSetup, setPayoutsNeedSetup] = useState(false)
  const [enrichmentGaps, setEnrichmentGaps] = useState<ListingEnrichmentGap[]>([])
  const consumedRef = useRef(false)

  useEffect(() => {
    if (consumedRef.current) return
    consumedRef.current = true

    const found = consumeJustPublishedListingMarker(listingParam)
    if (!found) return
    setMarker(found)
    // Let the PDP paint first so the card slides in over the live listing.
    const raf = requestAnimationFrame(() => setVisible(true))

    const controller = new AbortController()
    void fetch("/api/stripe/connect/status", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return
        const status = (await res.json()) as { hasAccount?: boolean; payoutsEnabled?: boolean }
        if (status.hasAccount !== true || status.payoutsEnabled !== true) {
          setPayoutsNeedSetup(true)
        }
      })
      .catch(() => {
        /* nudge is best-effort */
      })

    // Enrichment prompts: what did the seller skip that would help it sell?
    // Quick publishes defer description/dimensions/shipping — surface them now.
    void fetch(`/api/listings/${found.listingId}/owned-edit`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return
        const json = (await res.json()) as {
          data?: {
            listing?: {
              section?: string | null
              description?: string | null
              dimensions?: string | null
              shipping_available?: boolean | null
              listing_images?: { id: string }[] | null
            }
          }
        }
        const listing = json.data?.listing
        if (!listing) return
        setEnrichmentGaps(
          computeListingEnrichmentGaps({
            section: listing.section ?? found.section,
            description: listing.description,
            dimensions: listing.dimensions,
            shippingAvailable: listing.shipping_available,
            photoCount: listing.listing_images?.length ?? 0,
          }),
        )
      })
      .catch(() => {
        /* prompts are best-effort */
      })

    return () => {
      cancelAnimationFrame(raf)
      controller.abort()
    }
  }, [listingParam])

  if (!marker) return null

  const handleShare = async () => {
    const url = window.location.href.split(/[?#]/)[0]
    try {
      if (navigator.share) {
        await navigator.share({ url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast.success("Link copied")
    } catch {
      /* user cancelled share sheet */
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4 sm:pb-6",
        "pointer-events-none",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto w-full max-w-md rounded-2xl border border-listingHeart/25 bg-white p-5 shadow-soft",
          "transition-all duration-500 ease-smooth",
          visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        )}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-listingHeart/10">
            <CheckCircle2 className="size-5 text-listingHeart" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-headline text-base font-bold text-foreground">
              Your listing is live
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              Buyers can see it right now. Share it to sell faster.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setVisible(false)}
            onTransitionEnd={() => {
              if (!visible) setMarker(null)
            }}
            aria-label="Dismiss"
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={handleShare}
          >
            <Link2 className="size-4" aria-hidden />
            Share link
          </Button>
          <Button
            asChild
            size="sm"
            className="flex-1 gap-1.5 bg-listingHeart text-white hover:bg-listingHeart/90"
          >
            <Link
              href={sellAgainHref(marker.section)}
              onClick={() => setSellEntryPoint("celebration")}
            >
              <Plus className="size-4" aria-hidden />
              List another
            </Link>
          </Button>
        </div>

        {enrichmentGaps.length > 0 ? (
          <div className="mt-3 rounded-lg bg-listingHeart/5 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
              <Sparkles className="size-3.5 text-listingHeart" aria-hidden />
              Help it sell faster
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {enrichmentGaps.map((gap) => (
                <Link
                  key={gap.id}
                  prefetch={false}
                  href={peerListingEditHref(marker.section, marker.listingId)}
                  className="rounded-full border border-listingHeart/30 bg-white px-3 py-1 text-xs font-medium text-listingHeart transition-colors hover:bg-listingHeart hover:text-white"
                >
                  {gap.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {payoutsNeedSetup ? (
          <Link
            href="/dashboard/payouts"
            className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted/70"
          >
            <Landmark className="size-4 shrink-0 text-listingHeart" aria-hidden />
            <span className="leading-snug">
              <span className="font-medium">Get paid when it sells</span>{" "}
              <span className="text-muted-foreground">— set up payouts in a minute.</span>
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  )
}
