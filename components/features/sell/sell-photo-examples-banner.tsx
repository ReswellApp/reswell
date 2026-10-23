"use client"

import { useState, type ComponentType } from "react"

import {
  SurfboardBottomIcon,
  SurfboardDeckIcon,
  SurfboardDingIcon,
  SurfboardRailsIcon,
  SurfboardScaleIcon,
  SurfboardTailIcon,
} from "@/components/features/sell/sell-photo-example-icons"
import { cn } from "@/lib/utils"

const HIDE_STORAGE_KEY = "sell-photo-examples-hidden"

interface PhotoExample {
  label: string
  Icon: ComponentType<{ className?: string }>
}

const SURFBOARD_PHOTO_EXAMPLES: readonly PhotoExample[] = [
  { label: "Primary", Icon: SurfboardDeckIcon },
  { label: "Bottom", Icon: SurfboardBottomIcon },
  { label: "Rails", Icon: SurfboardRailsIcon },
  { label: "Tail & fins", Icon: SurfboardTailIcon },
  { label: "Size and scale", Icon: SurfboardScaleIcon },
  // Zero-width space lets this wrap on a phone tile without a visible hyphen.
  { label: "Imper\u200Bfections", Icon: SurfboardDingIcon },
]

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
          {SURFBOARD_PHOTO_EXAMPLES.map(({ label, Icon }) => (
            <li
              key={label}
              className="flex aspect-square min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-border bg-white px-0.5 sm:gap-1.5 sm:px-1"
            >
              <Icon className="h-5 w-5 shrink-0 text-midgray/65 sm:h-6 sm:w-6" />
              <span className="w-full text-center text-[9px] font-medium leading-tight text-foreground sm:text-[11px]">
                {label}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
