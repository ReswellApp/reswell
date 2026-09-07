"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { formatGiveawayEndDate } from "@/lib/giveaways/catalog"
import { writeGiveawayEntryIntent } from "@/lib/giveaways/intent-storage"
import { logGiveawayEvent } from "@/lib/giveaways/log-event"
import {
  GIVEAWAYS_INDEX_HREF,
  giveawayCtaHref,
  isGiveawayStayOnSellPath,
} from "@/lib/giveaways/paths"
import { submitGiveawayEntry } from "@/lib/giveaways/submit-entry"
import { setSellEntryPoint } from "@/lib/sell-flow/sell-entry-point"
import type { Giveaway, GiveawayEventSurface } from "@/lib/types/giveaways"

type SellGiveawayEnterDialogProps = {
  open: boolean
  giveaway: Giveaway
  isLoggedIn: boolean
  onOpenChange: (open: boolean) => void
  onEntered: () => void
  /** Analytics surface for CTA events. Defaults to sell. */
  surface?: GiveawayEventSurface
}

/**
 * List-first enter dialog: explains the raffle and sends people to publish a
 * surfboard. Prize brand is chosen after the listing goes live.
 */
export function SellGiveawayEnterDialog({
  open,
  giveaway,
  isLoggedIn,
  onOpenChange,
  onEntered,
  surface = "sell",
}: SellGiveawayEnterDialogProps) {
  const pathname = usePathname()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ends = formatGiveawayEndDate(giveaway.endsAt)
  const stayOnSell = isGiveawayStayOnSellPath(pathname)

  const handleEnter = async () => {
    writeGiveawayEntryIntent({
      slug: giveaway.slug,
      brand: null,
      fromCta: !isLoggedIn,
    })
    logGiveawayEvent({
      slug: giveaway.slug,
      event: "cta_click",
      surface,
      preferredBrand: null,
    })
    setSellEntryPoint("giveaway")

    if (isLoggedIn) {
      setSaving(true)
      setError(null)
      const result = await submitGiveawayEntry({
        slug: giveaway.slug,
        preferredBrand: null,
      })
      setSaving(false)
      if (!result.ok) {
        setError(result.error ?? "Could not save your entry.")
        return
      }
      if (stayOnSell) {
        toast.success(
          result.entry?.status === "qualified"
            ? "You're in the raffle. Pick your custom after you publish — or on the listing page."
            : "Publish this board to finish your entry. You'll pick your custom after.",
        )
      }
    }

    onEntered()
    if (stayOnSell) return
    window.location.assign(giveawayCtaHref({ isLoggedIn, brand: null }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/50"
        className="max-h-[90vh] max-w-[420px] gap-0 overflow-y-auto border border-black/10 bg-white p-0 shadow-lg sm:rounded-2xl"
      >
        <DialogTitle className="sr-only">{giveaway.headline}</DialogTitle>
        <div className="relative px-6 pb-6 pt-7 sm:px-7 sm:pb-7 sm:pt-8">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm p-1 text-black/50 transition hover:text-black"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <p className="text-[11px] font-semibold uppercase tracking-widest text-listingHeart">
            {giveaway.eyebrow}
            {ends ? (
              <>
                <span aria-hidden> · </span>
                Ends {ends}
              </>
            ) : null}
          </p>
          <p className="pr-8 font-headline text-[1.75rem] font-bold leading-tight tracking-[-0.03em] text-black">
            {giveaway.headline}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-black/65">
            {giveaway.summary}
          </p>
          <p className="mt-2 text-[13px] text-black/50">{giveaway.scheduleLabel}</p>

          <ol className="mt-6 space-y-3">
            {giveaway.howItWorks.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-listingHeart text-xs font-semibold text-white"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-semibold text-black">{step.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-black/55">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {error ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            disabled={saving}
            className="mt-6 h-11 w-full rounded-full bg-listingHeart text-[14px] font-medium text-white hover:bg-[#2a4170]"
            onClick={() => void handleEnter()}
          >
            {saving
              ? "Saving…"
              : stayOnSell
                ? "Continue listing to enter"
                : isLoggedIn
                  ? "List a surfboard to enter"
                  : "Sign up & list a surfboard"}
          </Button>
          <p className="mt-2.5 text-center text-[12px] leading-snug text-black/45">
            Free to enter. Publishing a surfboard is your ticket — pick your custom after.
          </p>

          <p className="mt-3 text-center text-[11px] text-black/40">
            <Link
              href={GIVEAWAYS_INDEX_HREF}
              className="underline-offset-2 hover:underline"
              onClick={() => onOpenChange(false)}
            >
              Full giveaway page
            </Link>
          </p>

          <details className="group mt-4">
            <summary className="cursor-pointer list-none text-sm font-medium text-black marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-3">
                Official rules
                <span className="text-black/40 group-open:hidden" aria-hidden>
                  +
                </span>
                <span className="hidden text-black/40 group-open:inline" aria-hidden>
                  –
                </span>
              </span>
            </summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-black/55">
              {giveaway.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  )
}
