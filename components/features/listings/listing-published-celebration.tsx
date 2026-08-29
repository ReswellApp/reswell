"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Landmark, Link2, Plus, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import { GiveawayBrandPicker } from "@/components/features/giveaways/giveaway-brand-picker"
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
import {
  getGiveawayBySlug,
  giveawayPrizeBrandsFor,
  isGiveawayOpen,
  WIN_A_SURFBOARD_GIVEAWAY_SLUG,
} from "@/lib/giveaways/catalog"
import { logGiveawayEvent } from "@/lib/giveaways/log-event"
import { submitGiveawayEntry } from "@/lib/giveaways/submit-entry"
import { cn } from "@/lib/utils"
import type { GiveawayPrizeBrandId } from "@/lib/types/giveaways"

const RAFFLE_CELEBRATION_SEEN_PREFIX = "reswell.giveaway.raffleCelebrationSeen."

function raffleCelebrationSeenKey(slug: string): string {
  return `${RAFFLE_CELEBRATION_SEEN_PREFIX}${slug}`
}

function markRaffleCelebrationSeen(slug: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(raffleCelebrationSeenKey(slug), "1")
  } catch {
    /* private mode — one-time copy is best-effort */
  }
}

function hasSeenRaffleCelebration(slug: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(raffleCelebrationSeenKey(slug)) === "1"
  } catch {
    return false
  }
}

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
 * Raffle: when this listing is their ticket and they haven't picked a custom
 * yet, ask which prize brand they want to win.
 */
export function ListingPublishedCelebration({ listingParam }: { listingParam: string }) {
  const [marker, setMarker] = useState<JustPublishedListingMarker | null>(null)
  const [visible, setVisible] = useState(false)
  const [payoutsNeedSetup, setPayoutsNeedSetup] = useState(false)
  const [showRaffleEntry, setShowRaffleEntry] = useState(false)
  const [needsBrandPick, setNeedsBrandPick] = useState(false)
  const [raffleBrand, setRaffleBrand] = useState<GiveawayPrizeBrandId | null>(null)
  const [savingBrand, setSavingBrand] = useState(false)
  const [brandSaved, setBrandSaved] = useState(false)
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

    // Raffle: first qualifying surfboard (locked ticket) — prompt brand if missing.
    // Always show on just-published (marker is one-shot); localStorage only
    // suppresses the soft "you're in" line on later publishes of other gear.
    const giveaway = getGiveawayBySlug(WIN_A_SURFBOARD_GIVEAWAY_SLUG)
    if (found.section === "surfboards" && giveaway && isGiveawayOpen(giveaway)) {
      void fetch(`/api/giveaways/${WIN_A_SURFBOARD_GIVEAWAY_SLUG}/entry`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) return
          const json = (await res.json()) as {
            data?: {
              entry?: {
                listingId?: string | null
                status?: string
                preferredBrand?: GiveawayPrizeBrandId | null
              } | null
            }
          }
          const entry = json.data?.entry
          if (entry?.status !== "qualified") return
          if (entry.listingId !== found.listingId) return
          setShowRaffleEntry(true)
          if (!entry.preferredBrand) {
            setNeedsBrandPick(true)
          } else if (!hasSeenRaffleCelebration(WIN_A_SURFBOARD_GIVEAWAY_SLUG)) {
            markRaffleCelebrationSeen(WIN_A_SURFBOARD_GIVEAWAY_SLUG)
          }
        })
        .catch(() => {
          /* raffle line is best-effort */
        })
    }

    return () => {
      cancelAnimationFrame(raf)
      controller.abort()
    }
  }, [listingParam])

  if (!marker) return null

  const giveaway = getGiveawayBySlug(WIN_A_SURFBOARD_GIVEAWAY_SLUG)
  const prizeBrands = giveaway ? giveawayPrizeBrandsFor(giveaway) : []

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

  const handleSaveBrand = async () => {
    if (!raffleBrand || savingBrand) return
    setSavingBrand(true)
    logGiveawayEvent({
      slug: WIN_A_SURFBOARD_GIVEAWAY_SLUG,
      event: "brand_click",
      surface: "sell",
      preferredBrand: raffleBrand,
    })
    const result = await submitGiveawayEntry({
      slug: WIN_A_SURFBOARD_GIVEAWAY_SLUG,
      preferredBrand: raffleBrand,
    })
    setSavingBrand(false)
    if (!result.ok) {
      toast.error(result.error ?? "Could not save your pick.")
      return
    }
    setBrandSaved(true)
    setNeedsBrandPick(false)
    markRaffleCelebrationSeen(WIN_A_SURFBOARD_GIVEAWAY_SLUG)
    toast.success("Custom pick saved. You're in the raffle.")
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4",
        "pointer-events-none md:pb-3",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto w-full max-w-md rounded-2xl border border-listingHeart/25 bg-white p-5 shadow-soft",
          "transition-all duration-500 ease-smooth",
          needsBrandPick
            ? "md:max-w-lg md:rounded-2xl md:p-4"
            : "md:w-auto md:max-w-none md:rounded-xl md:p-2 md:pl-2.5",
          visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        )}
      >
        <div className="flex items-start gap-3 md:items-center md:gap-2">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-listingHeart/10 md:mt-0 md:size-7">
            <CheckCircle2 className="size-5 text-listingHeart md:size-3.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 md:flex-none">
            <p className="font-headline text-base font-bold text-foreground md:whitespace-nowrap md:text-sm">
              Your listing is live
              {showRaffleEntry && !needsBrandPick ? (
                <span className="hidden font-sans text-xs font-normal text-muted-foreground md:inline">
                  {" "}
                  ·{" "}
                  <Link
                    href="/giveaways"
                    className="font-medium text-listingHeart underline-offset-2 hover:underline"
                  >
                    In the raffle
                  </Link>
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground md:hidden">
              Buyers can see it right now. Share it to sell faster.
              {showRaffleEntry && !needsBrandPick ? (
                <>
                  {" "}
                  You&apos;re also in the{" "}
                  <Link
                    href="/giveaways"
                    className="font-medium text-listingHeart underline-offset-2 hover:underline"
                  >
                    custom surfboard raffle
                  </Link>
                  .
                </>
              ) : null}
            </p>
          </div>
          {!needsBrandPick ? (
            <div className="hidden shrink-0 gap-1.5 md:flex">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2.5"
                onClick={handleShare}
              >
                <Link2 className="size-3.5" aria-hidden />
                Share
              </Button>
              <Button
                asChild
                size="sm"
                className="h-8 gap-1 bg-listingHeart px-2.5 text-white hover:bg-listingHeart/90"
              >
                <Link
                  href={sellAgainHref(marker.section)}
                  onClick={() => setSellEntryPoint("celebration")}
                >
                  <Plus className="size-3.5" aria-hidden />
                  List another
                </Link>
              </Button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setVisible(false)}
            onTransitionEnd={() => {
              if (!visible) setMarker(null)
            }}
            aria-label="Dismiss"
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4 md:size-3.5" aria-hidden />
          </button>
        </div>

        {needsBrandPick && !brandSaved ? (
          <div className="mt-4 border-t border-listingHeart/15 pt-4">
            <p className="text-sm font-semibold text-foreground">
              Which custom do you want to win?
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              You&apos;re in the raffle. Pick your prize brand — you can change it later.
            </p>
            <div className="mt-3">
              <GiveawayBrandPicker
                brands={prizeBrands}
                value={raffleBrand}
                onChange={setRaffleBrand}
              />
            </div>
            <Button
              type="button"
              disabled={!raffleBrand || savingBrand}
              className="mt-3 h-10 w-full rounded-full bg-listingHeart text-sm font-medium text-white hover:bg-listingHeart/90"
              onClick={() => void handleSaveBrand()}
            >
              {savingBrand ? "Saving…" : "Save my pick"}
            </Button>
          </div>
        ) : null}

        {!needsBrandPick ? (
          <div className="mt-4 flex gap-2 md:hidden">
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
        ) : null}

        {enrichmentGaps.length > 0 && !needsBrandPick ? (
          <div className="mt-3 rounded-lg bg-listingHeart/5 px-3 py-2.5 md:mt-2 md:px-2 md:py-1.5">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-foreground md:text-xs">
              <Sparkles className="size-3.5 text-listingHeart" aria-hidden />
              Help it sell faster
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 md:mt-1.5">
              {enrichmentGaps.map((gap) => (
                <Link
                  key={gap.id}
                  prefetch={false}
                  href={peerListingEditHref(marker.section, marker.listingId)}
                  className="rounded-full border border-listingHeart/30 bg-white px-3 py-1 text-xs font-medium text-listingHeart transition-colors hover:bg-listingHeart hover:text-white md:px-2 md:py-0.5"
                >
                  {gap.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {payoutsNeedSetup && !needsBrandPick ? (
          <Link
            href="/dashboard/payouts"
            className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted/70 md:mt-2 md:px-2 md:py-1.5 md:text-xs"
          >
            <Landmark className="size-4 shrink-0 text-listingHeart md:size-3.5" aria-hidden />
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
