"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"
import { FadeInSection } from "@/components/fade-in-section"
import { GiveawayEnterBrandDialog } from "@/components/features/giveaways/giveaway-enter-brand-dialog"
import { GiveawayHero } from "@/components/features/giveaways/giveaway-hero"
import { GiveawaysDirectory } from "@/components/features/giveaways/giveaways-directory"
import {
  SELL_PAGE_GROUND_CLASS,
  SELL_PRIMARY_BUTTON_CLASS,
  SELL_SECTION_CARD_CLASS,
} from "@/components/features/sell/sell-form-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

const PROOF_POINTS = [
  { label: "Free to enter", detail: "Just list a board" },
  { label: "Choose from", detail: "any of the brands below" },
  { label: "No sale needed", detail: "Listing is the ticket" },
] as const

type GiveawaysHubProps = {
  giveaways: Giveaway[]
  isLoggedIn: boolean
  initialBrand?: GiveawayPrizeBrandId | null
}

function daysLeftLabel(endsAt: string): string | null {
  const end = new Date(endsAt).getTime()
  if (!Number.isFinite(end)) return null
  const days = Math.ceil((end - Date.now()) / 86_400_000)
  if (days <= 0) return null
  return days === 1 ? "1 day left to enter" : `${days} days left to enter`
}

export function GiveawaysHub({
  giveaways,
  isLoggedIn,
  initialBrand = null,
}: GiveawaysHubProps) {
  const featured = giveaways.find((giveaway) => isGiveawayOpen(giveaway)) ?? giveaways[0]
  const [brand, setBrand] = useState<GiveawayPrizeBrandId | null>(initialBrand)
  const [pickerOpen, setPickerOpen] = useState(false)

  if (!featured) {
    return <GiveawaysDirectory giveaways={giveaways} />
  }

  const brands = giveawayPrizeBrandsFor(featured)
  const moreGiveaways = giveaways.filter((giveaway) => giveaway.slug !== featured.slug)
  const daysLeft = daysLeftLabel(featured.endsAt)

  const persistBrand = (next: GiveawayPrizeBrandId) => {
    setBrand(next)
    writeGiveawayEntryIntent({ slug: featured.slug, brand: next })
    logGiveawayEvent({
      slug: featured.slug,
      event: "brand_click",
      surface: "giveaway_page",
      preferredBrand: next,
    })
    if (isLoggedIn) {
      void submitGiveawayEntry({
        slug: featured.slug,
        preferredBrand: next,
      })
    }
  }

  const goEnter = (nextBrand: GiveawayPrizeBrandId) => {
    writeGiveawayEntryIntent({
      slug: featured.slug,
      brand: nextBrand,
      fromCta: !isLoggedIn,
    })
    logGiveawayEvent({
      slug: featured.slug,
      event: "cta_click",
      surface: "giveaway_page",
      preferredBrand: nextBrand,
    })
    if (isLoggedIn) {
      setSellEntryPoint("giveaway")
      void submitGiveawayEntry({
        slug: featured.slug,
        preferredBrand: nextBrand,
      })
    }
    window.location.assign(giveawayCtaHref({ isLoggedIn, brand: nextBrand }))
  }

  const handleEnter = () => {
    if (!brand) {
      setPickerOpen(true)
      return
    }
    goEnter(brand)
  }

  return (
    <>
      <GiveawayHero giveaway={featured}>
        {daysLeft ? (
          <p className="mt-4 inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            {daysLeft}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            size="lg"
            type="button"
            className={cn("rounded-full", SELL_PRIMARY_BUTTON_CLASS)}
            onClick={handleEnter}
          >
            Enter the raffle
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
          <Link
            href="#how-to-enter"
            className="text-center text-sm font-medium text-white/80 underline-offset-4 hover:text-white hover:underline sm:text-left"
          >
            How it works
          </Link>
        </div>
      </GiveawayHero>

      <div
        className={cn(
          "relative z-10 -mt-6 rounded-t-3xl sm:-mt-8",
          SELL_PAGE_GROUND_CLASS,
        )}
      >
        <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6 sm:py-14">
          <FadeInSection>
            <div className="grid grid-cols-3 gap-3">
              {PROOF_POINTS.map((item) => (
                <Card key={item.label} className={cn(SELL_SECTION_CARD_CLASS, "shadow-surface")}>
                  <CardContent className="px-3 py-4 text-center sm:px-4">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{item.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </FadeInSection>

          <FadeInSection>
            <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              The custom you could win
            </h2>
            <p className="mt-2 text-pretty text-muted-foreground">
              Win a custom from any of the brands below.
            </p>
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {brands.map((item) => {
                const selected = brand === item.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => persistBrand(item.id)}
                      className={cn(
                        SELL_SECTION_CARD_CLASS,
                        "flex h-full w-full flex-col px-4 py-4 text-left transition-colors",
                        selected
                          ? "border-listingHeart bg-listingHeart text-white"
                          : "hover:bg-white/80",
                      )}
                    >
                      <p className="flex items-center justify-between gap-2 font-semibold">
                        <span>{item.name}</span>
                        {selected ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-sm leading-snug",
                          selected ? "text-white/80" : "text-muted-foreground",
                        )}
                      >
                        {item.tagline}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground sm:text-sm">
              You can change your brand later if you want.
            </p>
            {brand ? (
              <Button
                size="lg"
                type="button"
                className={cn("mt-5 rounded-full", SELL_PRIMARY_BUTTON_CLASS)}
                onClick={() => goEnter(brand)}
              >
                Enter raffle
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </FadeInSection>

          <FadeInSection>
            <section id="how-to-enter" className="scroll-mt-28">
              <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                How to enter
              </h2>
              <ol className="mt-6 grid gap-3 sm:grid-cols-3">
                {featured.howItWorks.map((step, index) => (
                  <li key={step.title}>
                    <Card className={cn(SELL_SECTION_CARD_CLASS, "h-full shadow-surface")}>
                      <CardContent className="px-4 py-5">
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-listingHeart text-sm font-semibold text-white"
                          aria-hidden
                        >
                          {index + 1}
                        </span>
                        <p className="mt-3 font-semibold text-foreground">{step.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {step.body}
                        </p>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ol>
            </section>
          </FadeInSection>

          <FadeInSection>
            <Card className={cn(SELL_SECTION_CARD_CLASS, "shadow-surface")}>
              <CardContent className="px-6 py-8 sm:px-8">
                <p className="text-xs font-semibold uppercase tracking-widest text-listingHeart">
                  {featured.scheduleLabel}
                </p>
                <h2 className="mt-3 font-headline text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  List a surfboard. You&apos;re in.
                </h2>
                <p className="mt-2 max-w-md text-pretty text-muted-foreground">
                  {featured.summary}
                </p>
                <Button
                  size="lg"
                  type="button"
                  className={cn("mt-6 rounded-full", SELL_PRIMARY_BUTTON_CLASS)}
                  onClick={handleEnter}
                >
                  Enter the raffle
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </CardContent>
            </Card>
          </FadeInSection>

          {moreGiveaways.length > 0 ? (
            <div>
              <h2 className="font-headline text-xl font-bold tracking-tight text-foreground">
                More raffles
              </h2>
              <GiveawaysDirectory giveaways={moreGiveaways} />
            </div>
          ) : null}
        </div>
      </div>

      <GiveawayEnterBrandDialog
        open={pickerOpen}
        brands={brands}
        value={brand}
        isLoggedIn={isLoggedIn}
        onOpenChange={setPickerOpen}
        onBrandChange={persistBrand}
        onContinue={(next) => {
          setPickerOpen(false)
          goEnter(next)
        }}
      />
    </>
  )
}
