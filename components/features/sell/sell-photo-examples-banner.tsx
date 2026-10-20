"use client"

import Image from "next/image"
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

interface ReferencePhoto {
  src: string
  label: string
  alt: string
}

const SURFBOARD_PHOTO_EXAMPLES: readonly PhotoExample[] = [
  { label: "Primary", Icon: SurfboardDeckIcon },
  { label: "Bottom", Icon: SurfboardBottomIcon },
  { label: "Rails", Icon: SurfboardRailsIcon },
  { label: "Tail & fins", Icon: SurfboardTailIcon },
  { label: "Size and scale", Icon: SurfboardScaleIcon },
  { label: "Imperfec\u00ADtions", Icon: SurfboardDingIcon },
]

/**
 * Straight-on wall shots for the deck and the bottom.
 * Rails, tail, scale, and dings stay drawings.
 */
const REFERENCE_PHOTOS: readonly ReferencePhoto[] = [
  {
    src: "/images/sell/photo-examples/deck.webp",
    label: "Primary",
    alt: "Example primary photo: full surfboard deck, straight on, against a plain wall",
  },
  {
    src: "/images/sell/photo-examples/bottom.webp",
    label: "Bottom",
    alt: "Example bottom photo: full surfboard bottom with fins, straight on, against a plain wall",
  },
]

function initiallyHidden(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(HIDE_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function ExampleReferencePhotos() {
  return (
    <ul className="flex shrink-0 gap-2" aria-label="Real photo references">
      {REFERENCE_PHOTOS.map((photo) => (
        <li key={photo.src} className="w-[3.15rem] sm:w-[3.5rem]">
          <div className="relative aspect-[5/11] overflow-hidden rounded-lg border border-border bg-muted">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="56px"
              className="object-cover"
            />
          </div>
          <span className="block px-0.5 py-1 text-center text-[9px] font-medium leading-tight text-foreground sm:py-1.5 sm:text-[11px]">
            {photo.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Shot checklist under the uploader, plus two real photos for the angles
 * they show. Squares stay a capped width so they don't grow with the sell form.
 * Hideable; stays hidden per device.
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
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <ul className="grid max-w-[34rem] flex-[1_1_17rem] grid-cols-6 gap-1.5 sm:gap-2">
            {SURFBOARD_PHOTO_EXAMPLES.map(({ label, Icon }) => (
              <li
                key={label}
                className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-white"
              >
                <div className="flex aspect-square items-center justify-center bg-muted/40 p-1 sm:p-2">
                  <Icon className="h-6 w-6 text-midgray/65 sm:h-7 sm:w-7" />
                </div>
                <span className="px-0.5 py-1 text-center text-[9px] font-medium leading-tight text-foreground sm:px-1 sm:py-1.5 sm:text-[11px]">
                  {label}
                </span>
              </li>
            ))}
          </ul>
          <ExampleReferencePhotos />
        </div>
      ) : null}
    </div>
  )
}
