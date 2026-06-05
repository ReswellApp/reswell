"use client"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export type SellSectionNavItem = {
  id: string
  label: string
  /** Shorter label for the compact (mobile) link row */
  shortLabel?: string
}

function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "start" })
}

export const SELL_FINS_FORM_SECTION_NAV_ITEMS: readonly SellSectionNavItem[] = [
  {
    id: "sell-fins-section-photos-title",
    label: "Title & photos",
    shortLabel: "Start",
  },
  {
    id: "sell-fins-section-details",
    label: "Fin details",
    shortLabel: "Details",
  },
  { id: "sell-fins-section-delivery", label: "Pickup & shipping", shortLabel: "Delivery" },
  {
    id: "sell-fins-section-publish",
    label: "Price & publish",
    shortLabel: "Publish",
  },
]

/**
 * Section nav items for an accessory-type sell flow (wetsuits, boardbags,
 * surfpacks, leashes, apparel, accessories). `prefix` is the section slug used in
 * each section's DOM id (e.g. "wetsuits" → "sell-wetsuits-section-photos-title").
 */
export function buildSellSectionNavItems(
  prefix: string,
  detailsLabel: string,
): readonly SellSectionNavItem[] {
  return [
    { id: `sell-${prefix}-section-photos-title`, label: "Title & photos", shortLabel: "Start" },
    { id: `sell-${prefix}-section-details`, label: detailsLabel, shortLabel: "Details" },
    { id: `sell-${prefix}-section-delivery`, label: "Pickup & shipping", shortLabel: "Delivery" },
    { id: `sell-${prefix}-section-publish`, label: "Price & publish", shortLabel: "Publish" },
  ]
}

export const SELL_FORM_SECTION_NAV_ITEMS: readonly SellSectionNavItem[] = [
  {
    id: "sell-section-photos-title",
    label: "Title & photos",
    shortLabel: "Start",
  },
  {
    id: "sell-section-board",
    label: "Board & description",
    shortLabel: "Board",
  },
  { id: "sell-section-delivery", label: "Pickup & shipping", shortLabel: "Delivery" },
  {
    id: "sell-section-publish",
    label: "Price & publish",
    shortLabel: "Publish",
  },
]

/**
 * Tablet (md–lg): horizontal stepper (circles, checkmarks, connector); hidden on small phones
 * and replaced by the vertical rail at lg+.
 */
export function SellSectionNavHorizontal({
  items,
  sectionCompletion,
  className,
}: {
  items: readonly SellSectionNavItem[]
  sectionCompletion?: Readonly<Partial<Record<string, boolean>>>
  className?: string
}) {
  return (
    <nav
      aria-label="Listing form sections"
      className={cn(
        "rounded-lg border border-border bg-card/80 py-3 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
        <ol className="mx-auto flex w-max min-w-full items-start justify-center gap-0 px-3 pb-0.5 pt-0.5 sm:px-4">
          {items.map((item, index) => {
            const complete = sectionCompletion?.[item.id] === true
            const label = item.shortLabel ?? item.label
            return (
              <li key={item.id} className="flex items-start">
                {index > 0 ? (
                  <div
                    className="mt-2.5 h-px w-2 shrink-0 bg-foreground/25 sm:w-3"
                    aria-hidden
                  />
                ) : null}
                <div className="flex w-[3rem] shrink-0 flex-col items-center px-0.5 sm:w-14">
                  <button
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    aria-label={
                      complete ? `${item.label}, completed` : `Go to ${item.label}`
                    }
                    className={cn(
                      "flex w-full flex-col items-center gap-1.5 rounded-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    )}
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground transition-opacity hover:opacity-90"
                      aria-hidden
                    >
                      {complete ? (
                        <Check
                          className="h-3 w-3 text-background"
                          strokeWidth={3}
                          aria-hidden
                        />
                      ) : null}
                    </span>
                    <span className="w-full text-center text-[10px] leading-tight text-foreground sm:text-xs">
                      {label}
                    </span>
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}

/**
 * Desktop sidebar: vertical stepper (bold rail + rings) with section labels; completed steps are solid with a check.
 */
export function SellSectionNav({
  items,
  sectionCompletion,
  className,
}: {
  items: readonly SellSectionNavItem[]
  /** When set, keys are section ids (see `SELL_FORM_SECTION_NAV_ITEMS`); completed steps render a check. */
  sectionCompletion?: Readonly<Partial<Record<string, boolean>>>
  className?: string
}) {
  return (
    <nav
      aria-label="Listing form sections"
      className={cn("sticky top-24", className)}
    >
      <div className="w-full overflow-auto rounded-xl bg-listingHeart px-3 py-6 xl:px-4">
        <div className="relative">
          <div
            className="absolute bottom-3 left-3 top-3 w-[3px] -translate-x-1/2 bg-white/35"
            aria-hidden
          />
          <ul className="relative m-0 list-none space-y-8 p-0">
            {items.map((item) => {
              const complete = sectionCompletion?.[item.id] === true
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    aria-label={
                      complete ? `${item.label}, completed` : `Go to ${item.label}`
                    }
                    className={cn(
                      "group flex w-full items-start gap-3 rounded-sm text-left",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-listingHeart",
                    )}
                  >
                    <span
                      className={cn(
                        "relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-opacity",
                        "group-hover:opacity-90",
                        complete
                          ? "bg-white"
                          : "border-[3px] border-white bg-listingHeart",
                      )}
                      aria-hidden
                    >
                      {complete ? (
                        <Check
                          className="h-3.5 w-3.5 text-listingHeart"
                          strokeWidth={3}
                          aria-hidden
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 max-w-[13rem] pt-1 text-sm leading-snug text-white/95 group-hover:underline group-hover:underline-offset-4">
                      {item.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </nav>
  )
}
