"use client"

import { useState } from "react"

import { ListingMediaFillImage } from "@/components/listing-media-fill-image"
import { SELL_PHOTO_GUIDE_EXAMPLES } from "@/lib/sell-flow/sell-photo-guide"
import { cn } from "@/lib/utils"

const HIDE_STORAGE_KEY = "sell-photo-examples-hidden"

function initiallyHidden(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(HIDE_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

/**
 * Shot checklist under the uploader. Each tile is a square so the row
 * stays short on the wide sell form. Hideable; stays hidden per device.
 * Photos are from Hayden's Quadratic Formula listing.
 */
export function SellPhotoExamplesBanner({ className }: { className?: string }) {
  const [hidden, setHidden] = useState(initiallyHidden)

  const toggle = () => {
    setHidden((prev) => {
      const next = !prev
      try {
        if (next) localStorage.setItem(HIDE_STORAGE_KEY, "1")
        else localStorage.removeItem(HIDE_STORAGE_KEY)
      } catch {
        /* quota / private mode */
      }
      return next
    })
  }

  return (
    <div className={cn("space-y-2.5 sm:space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-foreground sm:text-[15px]">Examples</h4>
        <button
          type="button"
          onClick={toggle}
          className="text-sm font-medium text-listingHeart transition-colors hover:text-listingHeart/80 sm:text-[15px]"
          aria-expanded={!hidden}
        >
          {hidden ? "Show" : "Hide"}
        </button>
      </div>
      {!hidden ? (
        <ul className="grid w-full max-w-[34rem] grid-cols-6 gap-1.5 sm:gap-2">
          {SELL_PHOTO_GUIDE_EXAMPLES.map((example) => (
            <li
              key={example.id}
              className="relative aspect-square min-w-0 overflow-hidden rounded-lg border border-border bg-white"
            >
              <ListingMediaFillImage src={example.path} alt={example.label} />
              <span className="absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/75 to-transparent px-0.5 pb-1 pt-3 text-center text-[9px] font-medium leading-tight text-white sm:text-[11px]">
                {example.label}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
