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
  { label: "Imperfections", Icon: SurfboardDingIcon },
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
 * Photo shot examples under the uploader — Reverb-style 2-up on mobile,
 * wider on desktop. Hideable; stays hidden per device.
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
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[15px] font-semibold text-foreground">Examples</h4>
        <button
          type="button"
          onClick={toggle}
          className="text-[15px] font-medium text-listingHeart transition-colors hover:text-listingHeart/80"
          aria-expanded={!hidden}
        >
          {hidden ? "Show" : "Hide"}
        </button>
      </div>
      {!hidden ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SURFBOARD_PHOTO_EXAMPLES.map(({ label, Icon }) => (
            <li
              key={label}
              className="flex flex-col overflow-hidden rounded-xl border border-border bg-white"
            >
              <div className="flex aspect-square items-center justify-center bg-muted/40 p-4">
                <Icon className="h-16 w-16 text-midgray/65 sm:h-14 sm:w-14" />
              </div>
              <span className="px-2 py-2.5 text-center text-sm leading-tight text-foreground">
                {label}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
