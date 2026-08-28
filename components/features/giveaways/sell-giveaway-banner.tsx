"use client"

import { useState } from "react"
import { ArrowRight } from "lucide-react"
import { SellGiveawayEnterDialog } from "@/components/features/giveaways/sell-giveaway-enter-dialog"
import { Button } from "@/components/ui/button"
import type { Giveaway } from "@/lib/types/giveaways"

type SellGiveawayBannerProps = {
  giveaway: Giveaway
  isLoggedIn: boolean
}

/**
 * Permanent giveaway CTA across /sell. Opens an enter dialog with raffle details.
 * Server layout omits this entirely when the signed-in user already has an entry.
 */
export function SellGiveawayBanner({
  giveaway,
  isLoggedIn,
}: SellGiveawayBannerProps) {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  return (
    <>
      <div
        className="sticky top-[var(--site-header-height,4rem)] z-30 shrink-0 border-b border-listingHeart/15 bg-[#EEF2F8]/95 backdrop-blur supports-[backdrop-filter]:bg-[#EEF2F8]/90"
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-w-0 flex-1 text-left transition-opacity hover:opacity-90"
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-listingHeart">
              {giveaway.eyebrow}
            </p>
            <p className="truncate text-sm font-semibold tracking-[-0.01em] text-foreground sm:text-[15px]">
              {giveaway.headline}
            </p>
          </button>
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 rounded-full bg-listingHeart px-3.5 text-xs font-medium text-white hover:bg-[#2a4170] sm:px-4 sm:text-sm"
            onClick={() => setOpen(true)}
          >
            Enter the raffle
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </div>
      <SellGiveawayEnterDialog
        open={open}
        giveaway={giveaway}
        isLoggedIn={isLoggedIn}
        onOpenChange={setOpen}
        onEntered={() => {
          setOpen(false)
          setHidden(true)
        }}
      />
    </>
  )
}
