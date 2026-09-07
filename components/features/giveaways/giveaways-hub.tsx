"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { GiveawayBrandPicker } from "@/components/features/giveaways/giveaway-brand-picker"
import { GiveawayHero } from "@/components/features/giveaways/giveaway-hero"
import { GiveawayHowItWorks } from "@/components/features/giveaways/giveaway-how-it-works"
import { GiveawaysDirectory } from "@/components/features/giveaways/giveaways-directory"
import {
  SELL_PAGE_GROUND_CLASS,
  SELL_PRIMARY_BUTTON_CLASS,
} from "@/components/features/sell/sell-form-surface"
import { Button } from "@/components/ui/button"
import {
  giveawayPrizeBrandsFor,
  isGiveawayOpen,
} from "@/lib/giveaways/catalog"
import { writeGiveawayEntryIntent } from "@/lib/giveaways/intent-storage"
import { logGiveawayEvent } from "@/lib/giveaways/log-event"
import { giveawayCtaHref } from "@/lib/giveaways/paths"
import { submitGiveawayEntry } from "@/lib/giveaways/submit-entry"
import { setSellEntryPoint } from "@/lib/sell-flow/sell-entry-point"
import { cn } from "@/lib/utils"
import type { Giveaway, GiveawayPrizeBrandId } from "@/lib/types/giveaways"

type GiveawaysHubProps = {
  giveaways: Giveaway[]
  isLoggedIn: boolean
}

export function GiveawaysHub({
  giveaways,
  isLoggedIn,
}: GiveawaysHubProps) {
  const featured = giveaways.find((giveaway) => isGiveawayOpen(giveaway)) ?? giveaways[0]
  const [navigating, setNavigating] = useState(false)
  const [showBrandPick, setShowBrandPick] = useState(false)
  const [prizeBrand, setPrizeBrand] = useState<GiveawayPrizeBrandId | null>(null)
  const [savingBrand, setSavingBrand] = useState(false)

  useEffect(() => {
    if (!isLoggedIn || !featured) return
    const slug = featured.slug
    const controller = new AbortController()
    void fetch(`/api/giveaways/${slug}/entry`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return
        const json = (await res.json()) as {
          data?: {
            entry?: {
              status?: string
              preferredBrand?: GiveawayPrizeBrandId | null
            } | null
          }
        }
        const entry = json.data?.entry
        if (entry?.status === "qualified" && !entry.preferredBrand) {
          setShowBrandPick(true)
        }
      })
      .catch(() => {
        /* prize pick is best-effort */
      })
    return () => controller.abort()
  }, [featured?.slug, isLoggedIn])

  if (!featured) {
    return <GiveawaysDirectory giveaways={giveaways} />
  }

  const brands = giveawayPrizeBrandsFor(featured)
  const moreGiveaways = giveaways.filter((giveaway) => giveaway.slug !== featured.slug)
  const brandNames = brands.map((brand) => brand.name).join(" · ")

  const goEnter = () => {
    if (navigating) return
    setNavigating(true)
    writeGiveawayEntryIntent({
      slug: featured.slug,
      brand: null,
      fromCta: !isLoggedIn,
    })
    logGiveawayEvent({
      slug: featured.slug,
      event: "cta_click",
      surface: "giveaway_page",
      preferredBrand: null,
    })
    if (isLoggedIn) {
      setSellEntryPoint("giveaway")
      void submitGiveawayEntry({
        slug: featured.slug,
        preferredBrand: null,
      })
    }
    window.location.assign(giveawayCtaHref({ isLoggedIn, brand: null }))
  }

  const savePrizeBrand = async () => {
    if (!prizeBrand || savingBrand) return
    setSavingBrand(true)
    logGiveawayEvent({
      slug: featured.slug,
      event: "brand_click",
      surface: "giveaway_page",
      preferredBrand: prizeBrand,
    })
    const result = await submitGiveawayEntry({
      slug: featured.slug,
      preferredBrand: prizeBrand,
    })
    setSavingBrand(false)
    if (!result.ok) {
      toast.error(result.error ?? "Could not save your pick.")
      return
    }
    setShowBrandPick(false)
    toast.success("Custom pick saved.")
  }

  return (
    <>
      <GiveawayHero giveaway={featured}>
        <p className="mt-4 text-sm font-medium text-white/80">
          {featured.scheduleLabel}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {showBrandPick ? (
            <Button
              size="lg"
              type="button"
              className={cn("rounded-full", SELL_PRIMARY_BUTTON_CLASS)}
              onClick={() => {
                document.getElementById("pick-your-custom")?.scrollIntoView({
                  behavior: "smooth",
                })
              }}
            >
              Pick your custom
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button
              size="lg"
              type="button"
              className={cn("rounded-full", SELL_PRIMARY_BUTTON_CLASS)}
              disabled={navigating}
              onClick={goEnter}
            >
              Enter the raffle
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          )}
          <Link
            href="#how-to-enter"
            className="text-center text-sm font-medium text-white/80 underline-offset-4 hover:text-white hover:underline sm:text-left"
          >
            How it works
          </Link>
        </div>
      </GiveawayHero>

      <div className={cn("relative z-10", SELL_PAGE_GROUND_CLASS)}>
        <div className="mx-auto max-w-xl space-y-12 px-4 py-12 sm:px-6 sm:py-16">
          {showBrandPick ? (
            <section
              id="pick-your-custom"
              className="scroll-mt-28 space-y-4 border-b border-border/70 pb-12"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-listingHeart">
                You&apos;re in
              </p>
              <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground">
                Which custom do you want?
              </h2>
              <p className="text-pretty text-muted-foreground">
                Your listing is your ticket. You can change this later.
              </p>
              <GiveawayBrandPicker
                brands={brands}
                value={prizeBrand}
                onChange={setPrizeBrand}
              />
              <Button
                size="lg"
                type="button"
                className={cn("rounded-full", SELL_PRIMARY_BUTTON_CLASS)}
                disabled={!prizeBrand || savingBrand}
                onClick={() => void savePrizeBrand()}
              >
                {savingBrand ? "Saving…" : "Save my pick"}
              </Button>
            </section>
          ) : null}

          <section id="how-to-enter" className="scroll-mt-28">
            <GiveawayHowItWorks steps={featured.howItWorks} />
          </section>

          <section>
            <h2 className="font-headline text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Prize brands
            </h2>
            <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
              {brandNames}
            </p>
          </section>

          {!showBrandPick ? (
            <section className="border-t border-border/70 pt-10">
              <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground">
                Ready?
              </h2>
              <p className="mt-2 text-pretty text-muted-foreground">
                Free to enter. Publishing a surfboard is your ticket — no sale
                required.
              </p>
              <Button
                size="lg"
                type="button"
                className={cn("mt-5 rounded-full", SELL_PRIMARY_BUTTON_CLASS)}
                disabled={navigating}
                onClick={goEnter}
              >
                Enter the raffle
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </section>
          ) : null}

          <section className="border-t border-border/70 pt-8">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Only surfers in the USA can win.
            </p>
            <details className="group mt-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  Official rules
                  <span className="text-muted-foreground group-open:hidden" aria-hidden>
                    +
                  </span>
                  <span className="hidden text-muted-foreground group-open:inline" aria-hidden>
                    –
                  </span>
                </span>
              </summary>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                {featured.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </details>
          </section>

          {moreGiveaways.length > 0 ? (
            <section>
              <h2 className="font-headline text-xl font-bold tracking-tight text-foreground">
                More raffles
              </h2>
              <GiveawaysDirectory giveaways={moreGiveaways} />
            </section>
          ) : null}
        </div>
      </div>
    </>
  )
}
