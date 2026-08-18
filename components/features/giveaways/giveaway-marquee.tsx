"use client"

import { useLayoutEffect, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import {
  getGiveawayBySlug,
  isGiveawayOpen,
  WIN_A_SURFBOARD_GIVEAWAY_SLUG,
} from "@/lib/giveaways/catalog"
import {
  dismissGiveawayMarquee,
  hasDismissedGiveawayMarquee,
} from "@/lib/giveaways/marquee-storage"
import { GIVEAWAYS_INDEX_HREF } from "@/lib/giveaways/paths"

const PHRASE = "Win a custom surfboard by listing a surfboard"
const LEARN_MORE = "learn more"
const REPEAT = 6

export function isGiveawayMarqueeActive(): boolean {
  const giveaway = getGiveawayBySlug(WIN_A_SURFBOARD_GIVEAWAY_SLUG)
  return Boolean(giveaway && isGiveawayOpen(giveaway))
}

function MarqueeCopy({ hidden = false }: { hidden?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-2 whitespace-nowrap px-3 text-[13px] font-medium tracking-[-0.01em] text-foreground lg:gap-3 lg:px-10"
      aria-hidden={hidden || undefined}
    >
      {PHRASE}
      <span className="underline underline-offset-2">{LEARN_MORE}</span>
      <span className="text-foreground/25" aria-hidden>
        ·
      </span>
    </span>
  )
}

function MarqueeTrack() {
  return (
    <div className="flex shrink-0 items-center" aria-hidden>
      {Array.from({ length: REPEAT }, (_, index) => (
        <MarqueeCopy key={index} hidden />
      ))}
    </div>
  )
}

export function GiveawayMarquee() {
  const [visible, setVisible] = useState<boolean | null>(null)

  useLayoutEffect(() => {
    setVisible(!hasDismissedGiveawayMarquee(WIN_A_SURFBOARD_GIVEAWAY_SLUG))
  }, [])

  if (visible !== true) return null

  return (
    <div className="relative shrink-0 border-b border-listingHeart/15 bg-listingHeart/[0.07]">
      <Link
        href={GIVEAWAYS_INDEX_HREF}
        aria-label={`${PHRASE}, ${LEARN_MORE}`}
        className="relative flex overflow-hidden py-2.5 pr-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-listingHeart lg:py-3.5"
      >
        <span className="mx-auto hidden items-center justify-center px-4 motion-reduce:inline-flex">
          <MarqueeCopy />
        </span>
        <div className="flex w-max animate-marquee-x motion-reduce:hidden hover:[animation-play-state:paused] [--marquee-duration:58s] lg:[--marquee-duration:72s]">
          <MarqueeTrack />
          <MarqueeTrack />
        </div>
      </Link>
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center bg-gradient-to-l from-background from-45% to-transparent pl-10 pr-1.5">
        <button
          type="button"
          className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-listingHeart"
          aria-label="Dismiss giveaway banner"
          onClick={() => {
            dismissGiveawayMarquee(WIN_A_SURFBOARD_GIVEAWAY_SLUG)
            setVisible(false)
          }}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}
