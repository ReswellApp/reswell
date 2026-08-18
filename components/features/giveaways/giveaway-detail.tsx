"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { GiveawayBrandPicker } from "@/components/features/giveaways/giveaway-brand-picker"
import { GiveawayHowItWorks } from "@/components/features/giveaways/giveaway-how-it-works"
import {
  SELL_PAGE_GROUND_CLASS,
  SELL_PRIMARY_BUTTON_CLASS,
  SELL_SECTION_CARD_CLASS,
} from "@/components/features/sell/sell-form-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  formatGiveawayEndDate,
  giveawayPrizeBrandsFor,
  isGiveawayOpen,
} from "@/lib/giveaways/catalog"
import { writeGiveawayEntryIntent } from "@/lib/giveaways/intent-storage"
import { logGiveawayEvent } from "@/lib/giveaways/log-event"
import { giveawayCtaHref } from "@/lib/giveaways/paths"
import { submitGiveawayEntry } from "@/lib/giveaways/submit-entry"
import { setSellEntryPoint } from "@/lib/sell-flow/sell-entry-point"
import type { Giveaway, GiveawayEntry, GiveawayPrizeBrandId } from "@/lib/types/giveaways"

type GiveawayDetailProps = {
  giveaway: Giveaway
  isLoggedIn: boolean
  initialEntry: GiveawayEntry | null
  initialBrand?: GiveawayPrizeBrandId | null
}

function brandForGiveaway(
  giveaway: Giveaway,
  brand: GiveawayPrizeBrandId | null | undefined,
): GiveawayPrizeBrandId | null {
  if (!brand) return null
  return giveaway.prizeBrands.includes(brand) ? brand : null
}

export function GiveawayDetail({
  giveaway,
  isLoggedIn,
  initialEntry,
  initialBrand,
}: GiveawayDetailProps) {
  const urlBrand = brandForGiveaway(giveaway, initialBrand)
  const [brand, setBrand] = useState<GiveawayPrizeBrandId | null>(
    urlBrand ?? initialEntry?.preferredBrand ?? null,
  )
  const [entry, setEntry] = useState<GiveawayEntry | null>(initialEntry)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = isGiveawayOpen(giveaway)
  const brands = giveawayPrizeBrandsFor(giveaway)
  const ends = formatGiveawayEndDate(giveaway.endsAt)
  const href = giveawayCtaHref({ isLoggedIn, brand })
  const qualified = entry?.status === "qualified"
  const appliedUrlBrand = useRef(false)

  const persistBrand = async (next: GiveawayPrizeBrandId) => {
    setBrand(next)
    writeGiveawayEntryIntent({ slug: giveaway.slug, brand: next })
    logGiveawayEvent({
      slug: giveaway.slug,
      event: "brand_click",
      surface: "giveaway_page",
      preferredBrand: next,
    })
    if (!isLoggedIn) return
    setSaving(true)
    setError(null)
    const result = await submitGiveawayEntry({
      slug: giveaway.slug,
      preferredBrand: next,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? "Could not save your pick.")
      return
    }
    if (result.entry) setEntry(result.entry)
  }

  useEffect(() => {
    if (!urlBrand || !open || appliedUrlBrand.current) return
    appliedUrlBrand.current = true
    void persistBrand(urlBrand)
  }, [open, urlBrand])

  const handleCta = () => {
    writeGiveawayEntryIntent({
      slug: giveaway.slug,
      brand,
      fromCta: !isLoggedIn,
    })
    logGiveawayEvent({
      slug: giveaway.slug,
      event: "cta_click",
      surface: "giveaway_page",
      preferredBrand: brand,
    })
    if (isLoggedIn) {
      setSellEntryPoint("giveaway")
      if (brand) {
        void submitGiveawayEntry({ slug: giveaway.slug, preferredBrand: brand })
      }
    }
  }

  return (
    <div
      className={cn(
        "relative z-10 -mt-6 rounded-t-3xl sm:-mt-8",
        SELL_PAGE_GROUND_CLASS,
      )}
    >
      <div className="mx-auto max-w-2xl space-y-10 px-4 py-10 sm:px-6 sm:py-14">
        {qualified ? (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-listingHeart/10 px-3 py-1 text-xs font-medium text-listingHeart">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            You&apos;re in the raffle
          </p>
        ) : entry ? (
          <p className="text-sm font-medium text-listingHeart">
            Brand saved. List a surfboard to finish your entry.
          </p>
        ) : null}

        <GiveawayHowItWorks steps={giveaway.howItWorks} />

        {open ? (
          <section id="enter" className="scroll-mt-28">
            <h2 className="font-headline text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {qualified ? "Your custom pick" : "Enter the raffle"}
            </h2>
            <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              {qualified
                ? "This is the brand you’re entered for."
                : "Pick a brand, then list a surfboard. That’s your entry."}
            </p>
            <Card className={cn(SELL_SECTION_CARD_CLASS, "mt-5 shadow-surface")}>
              <CardContent className="p-5 sm:p-7">
                <GiveawayBrandPicker
                  brands={brands}
                  value={brand}
                  onChange={(next) => void persistBrand(next)}
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  You can change your brand later if you want.
                </p>
                {saving ? (
                  <p className="mt-1 text-xs text-muted-foreground">Saving your pick…</p>
                ) : null}
                {error ? (
                  <p className="mt-2 text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button
                  size="lg"
                  className={cn("mt-6 w-full rounded-full sm:w-auto", SELL_PRIMARY_BUTTON_CLASS)}
                  asChild
                >
                  <Link href={href} onClick={handleCta}>
                    {qualified
                      ? "List another surfboard"
                      : isLoggedIn
                        ? "List a surfboard to enter"
                        : "Sign up & list a surfboard"}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <p className="mt-3 text-sm text-muted-foreground">
                  Free to list. No sale required. Winner drawn October 3rd.
                </p>
              </CardContent>
            </Card>
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">
            This giveaway {ends ? `ended ${ends}` : "is no longer open"}.
          </p>
        )}

        <details className="group">
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
            {giveaway.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  )
}
