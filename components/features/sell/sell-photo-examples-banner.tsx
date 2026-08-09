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
 * Photo shot examples under the uploader — one compact row on mobile,
 * wider tiles from `sm` up. Hideable; stays hidden per device.
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
        <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
          {SURFBOARD_PHOTO_EXAMPLES.map(({ label, Icon }) => (
            <li
              key={label}
              className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-white sm:rounded-xl"
            >
              <div className="flex aspect-square items-center justify-center bg-muted/40 p-1 sm:p-4">
                <Icon className="h-7 w-7 text-midgray/65 sm:h-14 sm:w-14" />
              </div>
              <span className="px-0.5 py-1 text-center text-[9px] font-medium leading-tight text-foreground sm:px-2 sm:py-2.5 sm:text-sm sm:font-normal">
                {label}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
