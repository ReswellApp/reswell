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
 * "Examples" strip above the photo uploader — shows the shots that make a
 * surfboard listing sell (Reverb-style). Hideable, and stays hidden per device.
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
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-foreground">Examples</h4>
        <button
          type="button"
          onClick={toggle}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          aria-expanded={!hidden}
        >
          {hidden ? "Show" : "Hide"}
        </button>
      </div>
      {!hidden ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {SURFBOARD_PHOTO_EXAMPLES.map(({ label, Icon }) => (
            <li
              key={label}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-white px-2 pb-2.5 pt-3"
            >
              <Icon className="h-12 w-12 text-midgray/70" />
              <span className="text-center text-xs leading-tight text-foreground">
                {label}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
